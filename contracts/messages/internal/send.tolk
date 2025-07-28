import "../../constants/common-types";
import "../../types/vault-result";
import "../../types/asset";
import "../../storage";
import "../../helper/jetton";
import "schemas";

@pure
fun createVaultNotificationParams(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): VaultNotificationParams? {
    return callbackParams != null ? 
        VaultNotificationParams {
            vaultResult: vaultResult,
            initiator: initiator,
            callbackPayload: callbackParams!.payload,
            inMsgPayload: callbackParams!.includeBody ? inMsgPayload : null
        } : null;
}

@pure
fun createForwardPayload(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsgPayload: cell): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsgPayload);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(initiator: address, queryId: QueryId, sendingValue: coins, receiver: address, shares: coins, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
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
    initiator: address, 
    queryId: QueryId, 
    sendingValue: coins, 
    jettonWallet: address, 
    receiver: address, 
    transferAmount: coins, 
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
            jettonAmount: transferAmount,
            transferRecipient: receiver,
            sendExcessesTo: receiver,
            customPayload: null,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, sendingValue),
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, sendingValue: coins, receiver: address, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsgPayload: cell) {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsgPayload);
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
