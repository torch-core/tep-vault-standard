import "../constants/common-types";
import "../constants/errors"
import "../types/callback-params";
import "../types/asset"
import "schemas/common"
import "schemas/deploy"
import "schemas/provide-take-quote"
import "../storage";
import "../helper/jetton";
import "../fees-management"

struct TransferParams {
    asset: Asset;
    txContext: TxContext;
    transferAmount: coins;
    receiver: address;
    resultCode: ResultCode;
    callbackParams: CallbackParams;
    assetJettonWallet: address? = null;
}

@pure
fun resolveReceiver(receiver: address, initiator: address) {
    // If receiver is None -> use initiator as receiver
    return receiver.isNone() ? initiator : receiver;
}

@pure
fun createVaultNotificationParams(resultCode: ResultCode, initiator: address, callbackParams: CallbackParams, inBody: slice): VaultNotificationParams {
    return VaultNotificationParams {
        resultCode: resultCode,
        initiator: initiator,
        callbackPayload: callbackParams.payload,
        inBody: callbackParams.includeBody ? inBody.toCell() : null
    };
}

@pure
fun createForwardPayload(resultCode: ResultCode, initiator: address, callbackParams: CallbackParams, inBody: slice): Cell<VaultNotificationFp> {
    return VaultNotificationFp { vaultNotificationParams: createVaultNotificationParams(resultCode, initiator, callbackParams, inBody) }.toCell();
}

fun mint(txContext: TxContext, mutate receiver: address, shares: coins, resultCode: ResultCode, callbackParams: CallbackParams) {
    assert (shares > 0) throw ERR_INVALID_TRANSFER_AMOUNT;
    
    receiver = resolveReceiver(receiver, txContext.initiator);
    val storage = lazy VaultStorage.load();
    val minterAddress = contract.getAddress();
    val mintMsg = createMessage({
        bounce: false,
        dest: calcDeployedJettonWallet(receiver, minterAddress, storage.jettonWalletCode),
        value: txContext.remainingValue,
        body: InternalTransferStep {
            queryId: txContext.queryId,
            jettonAmount: shares,
            initiator: minterAddress,
            sendExcessesTo: receiver,
            forwardTonAmount: txContext.remainingValue - JETTON_TRANSFER_FEE,
            forwardPayload: createForwardPayload(resultCode, txContext.initiator, callbackParams, txContext.inBody)
        },
    });
    mintMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(
    txContext: TxContext, 
    assetJettonWallet: address, 
    receiver: address, 
    transferAmount: coins, 
    resultCode: ResultCode, 
    callbackParams: CallbackParams, 
) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    val transferMsg = createMessage({
        bounce: false,
        dest: assetJettonWallet,
        value: txContext.remainingValue,
        body: AskToTransfer {
            queryId: txContext.queryId,
            jettonAmount: transferAmount,
            transferRecipient: resolveReceiver(receiver, txContext.initiator),
            sendExcessesTo: txContext.initiator,
            customPayload: null,
            forwardTonAmount: txContext.remainingValue - JETTON_TRANSFER_FEE,
            forwardPayload: createForwardPayload(resultCode, txContext.initiator, callbackParams, txContext.inBody)
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(txContext: TxContext,transferAmount: coins, receiver: address, resultCode: ResultCode, callbackParams: CallbackParams) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;
    
    val transferMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: txContext.remainingValue + transferAmount, 
        body: VaultNotification {
            queryId: txContext.queryId,
            vaultNotificationParams: createVaultNotificationParams(resultCode, txContext.initiator, callbackParams, txContext.inBody)
        }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun extraCurrencyTransfer(
    txContext: TxContext, 
    extraCurrencyId: ExtraCurrencyId, 
    receiver: address, 
    transferAmount: coins, 
    resultCode: ResultCode, 
    callbackParams: CallbackParams, 
) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    var extraCurrencyMap: ExtraCurrenciesMap = createEmptyMap();
    extraCurrencyMap.set(extraCurrencyId, transferAmount as ExtraCurrencyAmount);
    val transferMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: (txContext.remainingValue, extraCurrencyMap),
        body: VaultNotificationEc {
            queryId: txContext.queryId,
            vaultNotificationParams: createVaultNotificationParams(resultCode, txContext.initiator, callbackParams, txContext.inBody)
        }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun transferAsset(transferParams: TransferParams) {
    match (transferParams.asset) {
        TonAsset => {
            tonTransfer(transferParams.txContext, transferParams.transferAmount, transferParams.receiver, transferParams.resultCode, transferParams.callbackParams);
        }
        JettonAsset => {
            assert (transferParams.assetJettonWallet != null) throw ERR_MISSING_ASSET_JETTON_WALLET;
            jettonTransfer(transferParams.txContext, transferParams.assetJettonWallet, transferParams.receiver, transferParams.transferAmount, transferParams.resultCode, transferParams.callbackParams);
        }
        ExtraCurrencyAsset => {
            extraCurrencyTransfer(transferParams.txContext, transferParams.asset.extraCurrencyId, transferParams.receiver, transferParams.transferAmount, transferParams.resultCode, transferParams.callbackParams);
        }
    }
}

fun sendRequestWalletAddress(jettonMaster: address, queryId: QueryId) {
    val requestMsg = createMessage({
        bounce: false,
        dest: jettonMaster, 
        value: REQUEST_JETTON_WALLET_ADDRESS_FEE,
        body: RequestWalletAddress { queryId: queryId, ownerAddress: contract.getAddress(), includeOwnerAddress: false }
    });
    requestMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun sendTakeQuote(txContext: TxContext, receiver: address, totalSupply: coins, normalizedTotalAssets: coins, forwardPayload: cell?) {
    val takeQuoteMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: txContext.remainingValue,
        body: TakeQuote { 
            queryId: txContext.queryId, 
            initiator: txContext.initiator, 
            totalSupply: totalSupply, 
            normalizedTotalAssets: normalizedTotalAssets, 
            timestamp: blockchain.now(), 
            forwardPayload: forwardPayload,
        }
    });
    takeQuoteMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}