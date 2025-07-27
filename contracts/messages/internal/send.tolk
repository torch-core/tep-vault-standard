import "schemas";
import "../../storage";
import "../../helper/jetton";
import "../../types/vault-result";
import "../../types/asset";
import "../../constants/common-types";

fun createVaultNotificationParams(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): VaultNotificationParams? {
    return callbackParams != null ? 
        VaultNotificationParams {
            vaultResult: vaultResult,
            initiator: initiator,
            callbackPayload: callbackParams!.callbackPayload,
            inMsgPayload: callbackParams!.includeBody ? inMsgPayload : null
        } : null;
}

fun createForwardPayload(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsgPayload);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(sendingValue: coins, queryId: QueryId, initiator: address, receiver: address, shares: coins, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(vaultResult, initiator, callbackParams, inMsgPayload);
    val mintMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: sendingValue,
        body: InternalTransferStep {
            queryId: queryId,
            jettonAmount: shares,
            transferInitiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, sendingValue),
            forwardPayload: forwardPayload
        },
    });
    mintMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(
    jettonWallet: address, 
    sendingValue: coins, 
    queryId: QueryId, 
    initiator: address, 
    receiver: address, 
    depositAmount: coins, 
    vaultResult: VaultResult, 
    callbackParams: CallbackParams?, 
    inMsgPayload: cell
) {
    val forwardPayload = createForwardPayload(vaultResult, initiator, callbackParams, inMsgPayload);
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
            forwardTonAmount: calcForwardTonAmount(forwardPayload, sendingValue),
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(receiver: address, sendingValue: coins, queryId: QueryId, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
    val params = createVaultNotificationParams(vaultResult, receiver, callbackParams, inMsgPayload);
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
    vaultResult: VaultResult, 
    callbackParams: CallbackParams?, 
    inMsgPayload: cell
) {
    match (assetType) {
        ASSET_TYPE_TON => {
            tonTransfer(receiver, amount, queryId, vaultResult, callbackParams, inMsgPayload);
        }
        ASSET_TYPE_JETTON => {
            jettonTransfer(jettonWallet!, sendingValue, queryId, initiator, receiver, amount, vaultResult, callbackParams, inMsgPayload);
        }
    }
}

