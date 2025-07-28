import "constants/errors";
import "types/asset";
import "storage"
import "helper/paramDefaulter";
import "helper/jetton"
import "messages/internal/schemas"
import "messages/internal/send"
import "core";
import "fees-management";
import "get-methods";

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
            assert (in.senderAddress.isAddressOfJettonWallet(inMsg.initiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;
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
                    val assetJettonWallet = storage.assetJettonInfo != null ? storage.assetJettonInfo!.load().walletAddress : null;
                    val withdrawAmount = handleWithdraw(inMsg.initiator, inMsg.queryId, remainingValue, inMsg.jettonAmount, withdrawParams, inMsg.toCell(), assetJettonWallet);

                    storage.totalSupply = storage.totalSupply - inMsg.jettonAmount; 
                    storage.totalAssets = storage.totalAssets - withdrawAmount;
                    storage.save();
                }
            }
        }

        ResponseWalletAddress => {
            var assetJettonInfo = storage.assetJettonInfo!.load();
            assert (in.senderAddress == assetJettonInfo.masterAddress!) throw ERR_INVALID_JETTON_MASTER; 
            assetJettonInfo.walletAddress = inMsg.jettonWalletAddress;
            storage.assetJettonInfo = assetJettonInfo.toCell();
            storage.save();
        }

        DeployVault => {
            if(inMsg.jettonMaster != null) { 
                assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_ADMIN;
                requestJettonWalletAddress(inMsg.jettonMaster!, inMsg.queryId);
                storage.assetJettonInfo = AssetJettonInfo { masterAddress: inMsg.jettonMaster!, walletAddress: null }.toCell();
                storage.save();
            }
        }

        else => {
            // ignore empty messages, throw ERR_INVALID_OPCODE for others
            assert (in.body.isEmpty()) throw ERR_INVALID_OPCODE
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {}
