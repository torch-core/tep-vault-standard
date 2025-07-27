import "schemas";
import "../../storage";
import "../../helper/jetton";
import "../../role-authority/constants/type";
import "../../types/response";
import "../../constants/values";
import "../../types/asset";

fun createVaultNotificationParams(status: VaultStatus, initiator: address, callbackParams: CallbackParams?, msgPayload: cell): VaultNotificationParams? {
    return callbackParams != null ? 
        VaultNotificationParams {
            status: status,
            initiator: initiator,
            callbackPayload: callbackParams!.callbackPayload,
            originMsgPayload: callbackParams!.includeBody ? msgPayload : null
        } : null;
}

fun createForwardPayload(status: VaultStatus, initiator: address, callbackParams: CallbackParams?, msgPayload: cell): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(status, initiator, callbackParams, msgPayload);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(sendingValue: coins, queryId: QueryId, initiator: address, receiver: address, shares: coins, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(status, initiator, callbackParams, msgPayload);
    val deployMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: sendingValue,
        body: InternalTransferStep {
            queryId: queryId,
            jettonAmount: shares,
            transferInitiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: forwardPayload == null ? 0 : sendingValue - JETTON_TRANSFER_FEE,
            forwardPayload: forwardPayload
        },
    });
    deployMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(jettonWallet: address, sendingValue: coins, queryId: QueryId, initiator: address, receiver: address, depositAmount: coins, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val forwardPayload = createForwardPayload(status, initiator, callbackParams, msgPayload);
    val transferMsg = createMessage({
        bounce: true,
        dest: jettonWallet,
        value: sendingValue,
        body: AskToTransfer {
            queryId: queryId,
            jettonAmount: depositAmount,
            transferRecipient: receiver,
            sendExcessesTo: receiver,
            customPayload: null,
            forwardTonAmount: forwardPayload == null ? 0 : sendingValue - JETTON_TRANSFER_FEE,
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(receiver: address, sendingValue: coins, queryId: QueryId, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val params = createVaultNotificationParams(status, receiver, callbackParams, msgPayload);
    val transferMsg = createMessage({
        bounce: true,
        dest: receiver,
        value: sendingValue,
        body: params != null ? 
            VaultNotification {
                queryId: queryId,
                vaultNotificationParams: params!
            } : null
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun withdraw(initiator: address, withdrawAmount: coins, queryId: QueryId, withdrawAsset: Asset?, withdrawAssetJettonWallet: address?, sendingValue: coins, withdrawParams: VaultWithdrawFp, msgPayload: cell) {
    match (withdrawAsset) {
        TonAsset => {
            tonTransfer(
                initiator,
                withdrawAmount,
                queryId,
                VaultStatus.Success(),
                withdrawParams.sucPayload,
                msgPayload
            );
        }
        JettonAsset => {
            jettonTransfer(
                withdrawAssetJettonWallet!, 
                sendingValue,
                queryId, 
                initiator, 
                withdrawParams.receiver!,
                withdrawAmount, 
                VaultStatus.Success(),
                withdrawParams.sucPayload, 
                msgPayload
            );
        }
        null => {
            // Default withdraw asset
        }
    }
}