tolk 1.0

import "storage"
import "messages/internal/schemas"
import "constants/errors";
import "fees-management";
import "helper/jetton";
import "types/asset";
import "core";
import "helper/paramNormalizer";

// the main entrypoint: called when a contract receives an message from other contracts
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

            // Update storage
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + inMsg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {
            match (inMsg.forwardPayload) {
                VaultDepositFp => {
                    validateJettonDepositGas(in.valueCoins);

                    val shares = handleDeposit(
                        in.senderAddress, 
                        inMsg.queryId, 
                        in.valueCoins,
                        inMsg.transferInitiator, 
                        inMsg.jettonAmount, 
                        normalizeDepositParams(inMsg.forwardPayload.vaultDepositParams, inMsg.transferInitiator), 
                        inMsg.toCell()
                    );

                    // Update storage
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
                        inMsg.queryId,
                        in.valueCoins,
                        in.senderAddress, 
                        inMsg.jettonAmount, 
                        normalizeWithdrawParams(burnPayload, in.senderAddress), 
                        inMsg.toCell(), 
                        storage.assetJettonWallet // This is withdraw jetton example, if you withdraw TON, this is null
                    );

                    // Update storage
                    storage.totalSupply = storage.totalSupply - inMsg.jettonAmount;
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
                    storage.save();
                }
            }
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

// a handler for bounced messages (not used here, may be ommited)
fun onBouncedMessage(in: InMessageBounced) {}
