import "../../constants/common-types";
import "../../types/vault-result";
import "../../types/asset";
import "../../types/callback-params";
import "../../storage";
import "../../helper/jetton";
import "schemas";

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

fun mint(initiator: address, queryId: QueryId, valueCoins: coins, receiver: address, shares: coins, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsg: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val forwardPayload = createForwardPayload(vaultResult, initiator, callbackParams, inMsg);
    val mintMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: valueCoins,
        body: InternalTransferStep {
            queryId: queryId,
            jettonAmount: shares,
            initiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, valueCoins),
            forwardPayload: forwardPayload
        },
    });
    mintMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(
    initiator: address, 
    queryId: QueryId, 
    valueCoins: coins, 
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
        value: valueCoins,
        body: AskToTransfer {
            queryId: queryId,
            jettonAmount: transferAmount,
            transferRecipient: receiver,
            sendExcessesTo: receiver,
            customPayload: null,
            forwardTonAmount: calcForwardTonAmount(forwardPayload, valueCoins),
            forwardPayload: forwardPayload
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, valueCoins: coins, receiver: address, vaultResult: VaultResult, callbackParams: CallbackParams?, inMsg: cell) {
    val params = createVaultNotificationParams(vaultResult, initiator, callbackParams, inMsg);
    val transferMsg = createMessage({
        bounce: true,
        dest: receiver,
        value: valueCoins, 
        body: params != null ? 
            VaultNotification {
                queryId: queryId,
                vaultNotificationParams: params!
            } : null
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}
