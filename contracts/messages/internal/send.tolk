import "../../constants/common-types";
import "../../types/vault-result";
import "../../types/asset";
import "../../types/callback-params";
import "../../storage";
import "../../helper/jetton";
import "schemas";
import "../../constants/values"

@pure
fun fillDefaultReceiver(receiver: address, initiator: address) {
    return receiver == createAddressNone() ? initiator : receiver;
}

@pure
fun createVaultNotificationParams(result: Result, initiator: address, callbackParams: Cell<CallbackParams>?, inBody: slice): VaultNotificationParams? {
    var callback: CallbackParams?;
    if(callbackParams == null) {
        callback = result == Result.Success() ? CallbackParams.defaultSuccess() : CallbackParams.defaultFailure();
    } else {
        callback = callbackParams.load();
    }

    return VaultNotificationParams {
        result: result,
        initiator: initiator,
        callbackPayload: callback.payload,
        inMsg: callback.includeBody ? inBody.toCell() : null
    };
}

@pure
fun createForwardPayload(result: Result, initiator: address, callbackParams: Cell<CallbackParams>?, inBody: slice): Cell<VaultNotificationFp>? {
    val params = createVaultNotificationParams(result, initiator, callbackParams, inBody);
    return params != null ? VaultNotificationFp { vaultNotificationParams: params! }.toCell() : null;
}

fun mint(initiator: address, queryId: QueryId, remainingValue: coins, receiver: address, shares: coins, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    receiver = fillDefaultReceiver(receiver, initiator);
    val storage = lazy VaultStorage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(result, initiator, callbackParams, inBody);
    val mintMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: remainingValue,
        body: InternalTransferStep {
            queryId: queryId,
            jettonAmount: shares,
            initiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: calcForwardTonAmount(callbackParams, remainingValue),
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
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
    inBody: slice
) {
    receiver = fillDefaultReceiver(receiver, initiator);
    val forwardPayload = createForwardPayload(result, initiator, callbackParams, inBody);
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
            forwardTonAmount: calcForwardTonAmount(callbackParams, remainingValue),
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, remainingValue: coins, receiver: address, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    val params = createVaultNotificationParams(result, initiator, callbackParams, inBody);
    val transferMsg = createMessage({
        bounce: true,
        dest: fillDefaultReceiver(receiver, initiator),
        value: remainingValue, 
        body: params != null ? 
            VaultNotification {
                queryId: queryId,
                vaultNotificationParams: params!
            } : null
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
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