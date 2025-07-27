tolk 1.0

import "constants/errors";
import "types/asset";
import "storage"
import "helper/paramNormalizer";
import "messages/internal/schemas"
import "core";
import "fees-management";

fun onInternalMessage(in: InMessage) {
    val inMsg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();

    match (inMsg) {
        VaultDeposit => {
            validateTonDepositGas(in.valueCoins, inMsg.depositAmount);

            val shares = handleDeposit(
                in.senderAddress, 
                inMsg.queryId, 
                in.valueCoins,
                in.senderAddress, 
                inMsg.depositAmount, 
                normalizeDepositParams(inMsg.vaultDepositParams, in.senderAddress), 
                inMsg.toCell()
            );

            // Update totalSupply and totalAssets
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            match (inMsg.forwardPayload) {
                VaultDepositFp => {
                    validateJettonDepositGas(in.valueCoins);

                    val shares = handleDeposit(
                        inMsg.transferInitiator, 
                        inMsg.queryId, 
                        in.valueCoins,
                        in.senderAddress, 
                        inMsg.jettonAmount, 
                        normalizeDepositParams(inMsg.forwardPayload.vaultDepositParams, inMsg.transferInitiator), 
                        inMsg.toCell()
                    );

                    // Update totalSupply and totalAssets
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

                    val withdrawAmount = handleWithdraw(
                        in.senderAddress, 
                        inMsg.queryId,
                        in.valueCoins,
                        inMsg.jettonAmount, 
                        normalizeWithdrawParams(burnPayload, in.senderAddress), 
                        inMsg.toCell(), 
                        storage.assetJettonWallet // Use null for TON Withdrawal
                    );

                    // Update totalSupply and totalAssets
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
