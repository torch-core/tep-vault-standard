import "schemas";
import "../../storage";
import "../../helper/jetton";
import "../../role-authority/constants/type";
import "../../types/response";

fun mint(sendingValue: coins, queryId: QueryId, sender: address, receiver: address, shares: coins, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val storage = lazy Storage.load();
    val minterAddress = contract.getAddress();
    val internalTransferBody: InternalTransferStep = {
        queryId: queryId,
        jettonAmount: shares,
        transferInitiator: minterAddress,
        sendExcessesTo: receiver,
        forwardTonAmount: 0,
        forwardPayload: 
            callbackParams != null ? 
                VaultNotificationFp {
                    vaultNotificationParams: VaultNotificationParams {
                        status: status,
                        initiator: sender,
                        callbackPayload: callbackParams!.callbackPayload,
                        originMsgPayload: callbackParams!.includeBody ? msgPayload : null
                    }
                }.toCell() : null
    };
    val deployMsg = createMessage({
        bounce: true,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: sendingValue,
        body: internalTransferBody,
    });
    deployMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(jettonWallet: address, sendingValue: coins, queryId: QueryId, sender: address, depositAmount: coins, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val minterAddress = contract.getAddress();
    val internalTransferBody: InternalTransferStep = {
        queryId: queryId,
        jettonAmount: depositAmount,
        transferInitiator: minterAddress,
        sendExcessesTo: sender,
        forwardTonAmount: 0,
        forwardPayload: 
            callbackParams != null ? 
                VaultNotificationFp {
                    vaultNotificationParams: VaultNotificationParams {
                        status: status,
                        initiator: sender,
                        callbackPayload: callbackParams!.callbackPayload,
                        originMsgPayload: callbackParams!.includeBody ? msgPayload : null
                    }
                }.toCell() : null
    };
    val transferMsg = createMessage({
        bounce: true,
        dest: jettonWallet,
        value: sendingValue,
        body: internalTransferBody,
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(sender: address, sendingValue: coins, queryId: QueryId, status: VaultStatus, callbackParams: CallbackParams?, msgPayload: cell) {
    val transferMsg = createMessage({
        bounce: true,
        dest: sender,
        value: sendingValue,
        body: 
            callbackParams != null ? 
                VaultNotification {
                    queryId: queryId,
                    vaultNotificationParams: VaultNotificationParams {
                        status: status,
                        initiator: sender,
                        callbackPayload: callbackParams!.callbackPayload,
                        originMsgPayload: callbackParams!.includeBody ? msgPayload : null
                    }
                } : null
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}