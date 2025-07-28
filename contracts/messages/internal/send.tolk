import "../../constants/common-types";
import "../../types/vault-result";
import "../../types/asset";
import "../../types/callback-params";
import "../../storage";
import "../../helper/jetton";
import "schemas";
import "../../constants/values"

@pure
fun createVaultNotificationParams(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsg: cell): VaultNotificationParams? {
    return callbackParams != null ? 
        VaultNotificationParams {
            vaultResult: vaultResult,
            initiator: initiator,
            callbackPayload: callbackParams!.payload,
            inMsg: callbackParams!.includeBody ? inMsg : null
        } : null;
}

@pure
fun createForwardPayload(vaultResult: VaultResult, initiator: address, callbackParams: CallbackParams?, inMsg: cell): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsg);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(initiator: address, queryId: QueryId, remainingValue: coins, receiver: address, shares: coins, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsg: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(vaultResult, initiator, callbackParams, inMsg);
    val mintMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: remainingValue,
        body: InternalTransferStep {
            queryId: queryId,
            jettonAmount: shares,
            initiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, remainingValue),
            forwardPayload: forwardPayload
        },
    });
    mintMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins, 
    jettonWallet: address, 
    receiver: address, 
    transferAmount: coins, 
    vaultResult: VaultResult, 
    callbackParams: CallbackParams?, 
    inMsg: cell
) {
    val forwardPayload = createForwardPayload(vaultResult, initiator, callbackParams, inMsg);
    val transferMsg = createMessage({
        bounce: true,
        dest: jettonWallet,
        value: remainingValue,
        body: AskToTransfer {
            queryId: queryId,
            jettonAmount: transferAmount,
            transferRecipient: receiver,
            sendExcessesTo: receiver,
            customPayload: null,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, remainingValue),
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, remainingValue: coins, receiver: address, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsg: cell) {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsg);
    val transferMsg = createMessage({
        bounce: true,
        dest: receiver,
        value: remainingValue, 
        body: params != null ? 
            VaultNotification {
                queryId: queryId,
                vaultNotificationParams: params!
            } : null
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun sendExcessesBack(sendExcessesTo: address, queryId: QueryId, remainingValue: coins) {
    val excessesMsg = createMessage({
        bounce: false,
        dest: sendExcessesTo,
        value: remainingValue - BURN_NOTIFICATION_FEE,
        body: ReturnExcessesBack { queryId: queryId }
    });
    excessesMsg.send(SEND_MODE_REGULAR);
}

fun requestJettonWalletAddress(jettonMaster: address, queryId: QueryId) {
    val requestMsg = createMessage({
        bounce: true,
        dest: jettonMaster,
        value: REQUEST_JETTON_WALLET_ADDRESS_FEE,
        body: RequestWalletAddress { queryId: queryId, ownerAddress: contract.getAddress(), includeOwnerAddress: false }
    });
    requestMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}