import "constants/errors";
import "types/asset";
import "storage"
import "helper/paramDefaulter";
import "messages/internal/schemas"
import "core";
import "fees-management";
import "get-methods";
import "messages/internal/send"

fun onInternalMessage(in: InMessage) {
    val inMsg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();

    match (inMsg) {
        VaultDeposit => {
            val remainingValue = processTonDepositGas(in.valueCoins, inMsg.depositAmount);
            val depositParams = fillDefaultDepositParams(inMsg.vaultDepositParams, in.senderAddress);
            val shares = handleDeposit(in.senderAddress, inMsg.queryId, remainingValue, in.senderAddress, inMsg.depositAmount, depositParams, inMsg.toCell());

            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            match (inMsg.forwardPayload) {
                VaultDepositFp => {
                    val remainingValue = processJettonDepositGas(in.valueCoins);
                    val depositParams = fillDefaultDepositParams(inMsg.forwardPayload.vaultDepositParams, inMsg.initiator);
                    val shares = handleDeposit(inMsg.initiator, inMsg.queryId, remainingValue, in.senderAddress, inMsg.jettonAmount, depositParams, inMsg.toCell());

                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + inMsg.jettonAmount;
                    storage.save();
                }
            }
        }

        BurnNotificationForMinter => {
            if (inMsg.customPayload == null && inMsg.sendExcessesTo != null) {
                val remainingValue = processBurnGas(in.valueCoins);
                sendExcessesBack(inMsg.sendExcessesTo, inMsg.queryId, remainingValue);
                storage.totalSupply = storage.totalSupply - inMsg.jettonAmount;
                storage.save();
                return;
            }

            var burnPayload = inMsg.customPayload!.load();
            match (burnPayload) {
                VaultWithdrawFp => {
                    val remainingValue = processWithdrawGas(in.valueCoins);
                    val withdrawParams = fillDefaultWithdrawParams(burnPayload, inMsg.initiator);
                    val withdrawAmount = handleWithdraw(inMsg.initiator, inMsg.queryId, remainingValue, inMsg.jettonAmount, withdrawParams, inMsg.toCell(), storage.assetJettonWallet);

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
