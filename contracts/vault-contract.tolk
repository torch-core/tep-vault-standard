import "constants/errors";
import "types/asset";
import "storage"
import "helper/paramDefaulter";
import "messages/internal/schemas"
import "core";
import "fees-management";
import "get-methods";

fun onInternalMessage(in: InMessage) {
    val inMsg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();

    match (inMsg) {
        VaultDeposit => {
            validateTonDepositGas(in.valueCoins, inMsg.depositAmount);
            val depositParams = fillDefaultDepositParams(inMsg.vaultDepositParams, in.senderAddress);
            val shares = handleDeposit(in.senderAddress, inMsg.queryId, in.valueCoins, in.senderAddress, inMsg.depositAmount, depositParams, inMsg.toCell());

            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            match (inMsg.forwardPayload) {
                VaultDepositFp => {
                    validateJettonDepositGas(in.valueCoins);
                    val depositParams = fillDefaultDepositParams(inMsg.forwardPayload.vaultDepositParams, inMsg.transferInitiator);
                    val shares = handleDeposit(inMsg.transferInitiator, inMsg.queryId, in.valueCoins, in.senderAddress, inMsg.jettonAmount, depositParams, inMsg.toCell());

                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + inMsg.jettonAmount;
                    storage.save();
                }
            }
        }

        BurnNotificationForMinter => {
            var burnPayload = inMsg.customPayload.load();
            match (burnPayload) {
                VaultWithdrawFp => {
                    validateWithdrawGas(in.valueCoins);
                    val withdrawParams = fillDefaultWithdrawParams(burnPayload, in.senderAddress);
                    val withdrawAmount = handleWithdraw(in.senderAddress, inMsg.queryId, in.valueCoins, inMsg.jettonAmount, withdrawParams, inMsg.toCell(), storage.assetJettonWallet);

                    storage.totalSupply = storage.totalSupply - inMsg.jettonAmount;
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
                    storage.save();
                }
            }
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {}
