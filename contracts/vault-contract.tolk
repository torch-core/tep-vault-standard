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
    val msg = lazy AllowedMessage.fromSlice(in.body);
    var storage = lazy Storage.load();

    match (msg) {
        VaultDeposit => {
            validateTonDepositGas(in.valueCoins, msg.depositAmount);

            val shares = handleDeposit(
                in.senderAddress, 
                msg.queryId, 
                in.valueCoins,
                in.senderAddress, 
                msg.depositAmount, 
                normalizeDepositParams(msg.vaultDepositParams, in.senderAddress), 
                msg.toCell(), 
                Asset.tonAsset()
            );

            // Update storage
            storage.totalSupply = storage.totalSupply + shares;
            storage.totalAssets = storage.totalAssets + msg.depositAmount;
            storage.save();
        }

        TransferNotificationForRecipient => {

            match (msg.forwardPayload) {
                VaultDepositFp => {
                    validateJettonDepositGas(in.valueCoins);

                    // Get Jetton Master Address by Jetton Wallet Address from walletToMaster dict
                    val jettonMaster = getJettonMasterFromWallet(storage.walletToMaster, in.senderAddress);

                    val shares = handleDeposit(
                        in.senderAddress, 
                        msg.queryId, 
                        in.valueCoins,
                        msg.transferInitiator, 
                        msg.jettonAmount, 
                        normalizeDepositParams(msg.forwardPayload.vaultDepositParams, msg.transferInitiator), 
                        msg.toCell(), 
                        Asset.jettonAsset(jettonMaster));

                    // Update storage
                    storage.totalSupply = storage.totalSupply + shares;
                    storage.totalAssets = storage.totalAssets + msg.jettonAmount;
                    storage.save();
                }
            }
        }

        BurnNotificationForMinter => {
            var burnPayload = msg.customPayload.load();
            match (burnPayload) {
                VaultWithdrawFp => {
                    validateWithdrawGas(in.valueCoins);

                    val withdrawAsset = burnPayload.withdrawAsset != null ? burnPayload.withdrawAsset!.load() : null;
                    val withdrawAssetJettonWallet =  (withdrawAsset is JettonAsset) ? getJettonWalletFromMaster(storage.masterToWallet, withdrawAsset.jettonMaster) : null;
                    val withdrawAmount = handleWithdraw(
                        msg.queryId,
                        in.valueCoins,
                        in.senderAddress, 
                        msg.jettonAmount, 
                        normalizeWithdrawParams(burnPayload, in.senderAddress), 
                        msg.toCell(), 
                        withdrawAssetJettonWallet,
                        withdrawAsset
                    );

                    // Update storage
                    storage.totalSupply = storage.totalSupply - msg.jettonAmount;
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
