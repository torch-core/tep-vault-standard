import "schemas";
import "../../storage";
import "../../helper/jetton";
import "../../types/vault-result";
import "../../constants/values";
import "../../types/asset";
import "../../constants/common-types";

fun createVaultNotificationParams(status: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): VaultNotificationParams? {
    return callbackParams != null ? 
        VaultNotificationParams {
            status: status,
            initiator: initiator,
            callbackPayload: callbackParams!.callbackPayload,
            inMsgPayload: callbackParams!.includeBody ? inMsgPayload : null
        } : null;
}

fun createForwardPayload(status: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(status, initiator, callbackParams, inMsgPayload);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(sendingValue: coins, queryId: QueryId, initiator: address, receiver: address, shares: coins, status: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(status, initiator, callbackParams, inMsgPayload);
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

fun jettonTransfer(
    jettonWallet: address, 
    sendingValue: coins, 
    queryId: QueryId, 
    initiator: address, 
    receiver: address, 
    depositAmount: coins, 
    status: VaultResult, 
    callbackParams: CallbackParams?, 
    inMsgPayload: cell
) {
    val forwardPayload = createForwardPayload(status, initiator, callbackParams, inMsgPayload);
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

fun tonTransfer(receiver: address, sendingValue: coins, queryId: QueryId, status: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
    val params = createVaultNotificationParams(status, receiver, callbackParams, inMsgPayload);
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

fun transferAsset(
    assetType: AssetType, 
    jettonWallet: address?, 
    sendingValue: coins, 
    queryId: QueryId, 
    initiator: address, 
    receiver: address, 
    amount: coins, 
    status: VaultResult, 
    callbackParams: CallbackParams?, 
    inMsgPayload: cell
) {
    match (assetType) {
        ASSET_TYPE_TON => {
            tonTransfer(receiver, amount, queryId, status, callbackParams, inMsgPayload);
        }
        ASSET_TYPE_JETTON => {
            jettonTransfer(jettonWallet!, sendingValue, queryId, initiator, receiver, amount, status, callbackParams, inMsgPayload);
        }
    }
}

