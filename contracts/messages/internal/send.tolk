import "../../constants/common-types";
import "../../constants/values"
import "../../types/vault-result";
import "../../types/asset";
import "../../types/callback-params";
import "../../storage";
import "../../helper/jetton";
import "schemas";
import "../../constants/errors"

@pure
fun resolveReceiver(receiver: address, initiator: address) {
    return receiver == createAddressNone() ? initiator : receiver;
}

@pure
fun createVaultNotificationParams(result: Result, initiator: address, callbackParams: Cell<CallbackParams>?, inBody: slice): VaultNotificationParams {
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
        inBody: callback.includeBody ? inBody.toCell() : null
    };
}

@pure
fun createForwardPayload(result: Result, initiator: address, callbackParams: Cell<CallbackParams>?, inBody: slice): Cell<VaultNotificationFp> {
    return VaultNotificationFp { vaultNotificationParams: createVaultNotificationParams(result, initiator, callbackParams, inBody) }.toCell();
}

fun mint(initiator: address, queryId: QueryId, remainingValue: coins, mutate receiver: address, shares: coins, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    receiver = resolveReceiver(receiver, initiator);
    val storage = lazy VaultStorage.load();
    val minterAddress = contract.getAddress();
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
            forwardPayload: createForwardPayload(result, initiator, callbackParams, inBody)
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
    receiver = resolveReceiver(receiver, initiator);
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
            forwardPayload: createForwardPayload(result, initiator, callbackParams, inBody)
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, sendingValue: coins, receiver: address, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    val transferMsg = createMessage({
        bounce: true,
        dest: resolveReceiver(receiver, initiator),
        value: sendingValue, 
        body: VaultNotification {
                queryId: queryId,
                vaultNotificationParams: createVaultNotificationParams(result, initiator, callbackParams, inBody)
            }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun transferAsset(
    isNativeTransfer: bool,
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins, 
    transferAmount: coins,
    receiver: address, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
    inBody: slice,
    assetJettonWallet: address? = null
) {
    if (isNativeTransfer) {
        tonTransfer(initiator, queryId, remainingValue + transferAmount, receiver, result, callbackParams, inBody);
        return;
    } 

    assert (assetJettonWallet != null) throw ERR_NULL_ASSET_JETTON_WALLET;
    jettonTransfer(initiator, queryId, remainingValue, assetJettonWallet!, receiver, transferAmount, result, callbackParams, inBody);   
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