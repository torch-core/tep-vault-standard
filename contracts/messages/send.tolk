import "@stdlib/tvm-dicts"
import "../constants/common-types";
import "../constants/values"
import "../constants/errors"
import "../types/vault-result";
import "../types/callback-params";
import "../types/asset"
import "schemas/common"
import "schemas/deploy"
import "schemas/provide-take-quote"
import "../storage";
import "../helper/jetton";
import "../helper/extra-currency"
import "../fees-management"

@pure
fun resolveReceiver(receiver: address, initiator: address) {
    // If receiver is None -> use initiator as receiver
    return receiver.isNone() ? initiator : receiver;
}

@pure
fun createVaultNotificationParams(result: Result, initiator: address, callbackParams: Cell<CallbackParams>?, inBody: slice): VaultNotificationParams {
    var callback: CallbackParams?;
    if (callbackParams == null) {
        // If callbackParams is null -> use default callbacks
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

fun mint(txContext: TxContext, mutate receiver: address, shares: coins, result: Result, callbackParams: Cell<CallbackParams>?) {
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
            forwardTonAmount: calcForwardTonAmount(callbackParams, txContext.remainingValue),
            forwardPayload: createForwardPayload(result, txContext.initiator, callbackParams, txContext.inBody)
        },
    });
    mintMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun jettonTransfer(
    txContext: TxContext, 
    jettonWallet: address, 
    receiver: address, 
    transferAmount: coins, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    receiver = resolveReceiver(receiver, txContext.initiator);
    val transferMsg = createMessage({
        bounce: false,
        dest: jettonWallet,
        value: txContext.remainingValue,
        body: AskToTransfer {
            queryId: txContext.queryId,
            jettonAmount: transferAmount,
            transferRecipient: receiver,
            sendExcessesTo: txContext.initiator,
            customPayload: null,
            forwardTonAmount: calcForwardTonAmount(callbackParams, txContext.remainingValue),
            forwardPayload: createForwardPayload(result, txContext.initiator, callbackParams, txContext.inBody)
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(txContext: TxContext,transferAmount: coins, receiver: address, result: Result, callbackParams: Cell<CallbackParams>?) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;
    
    val transferMsg = createMessage({
        bounce: true,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: txContext.remainingValue + transferAmount, 
        body: VaultNotification {
            queryId: txContext.queryId,
            vaultNotificationParams: createVaultNotificationParams(result, txContext.initiator, callbackParams, txContext.inBody)
        }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun extraCurrencyTransfer(
    txContext: TxContext, 
    extraCurrencyId: ExtraCurrencyId, 
    receiver: address, 
    transferAmount: coins, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    var extraCurrencyDict = createEmptyDict();
    extraCurrencyDict.uDictSetBuilder(EXTRA_CURRENCY_ID_SIZE, extraCurrencyId, beginCell().storeEcValue(transferAmount));
    val transferMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: (txContext.remainingValue, extraCurrencyDict),
        body: VaultNotificationEc {
            queryId: txContext.queryId,
            vaultNotificationParams: createVaultNotificationParams(result, txContext.initiator, callbackParams, txContext.inBody)
        }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun transferAsset(
    transferAsset: Asset,
    txContext: TxContext,
    transferAmount: coins,
    receiver: address, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
    assetJettonWallet: address? = null
) {
    match (transferAsset) {
        TonAsset => {
            tonTransfer(txContext, transferAmount, receiver, result, callbackParams);
        }
        JettonAsset => {
            assert (assetJettonWallet != null) throw ERR_MISSING_ASSET_JETTON_WALLET;
            jettonTransfer(txContext, assetJettonWallet!, receiver, transferAmount, result, callbackParams);
        }
        ExtraCurrencyAsset => {
            extraCurrencyTransfer(txContext, transferAsset.extraCurrencyId, receiver, transferAmount, result, callbackParams);
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

fun sendTakeQuote(txContext: TxContext, receiver: address, totalSupply: coins, totalAssets: coins, forwardPayload: cell?) {
    val takeQuoteMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, txContext.initiator),
        value: txContext.remainingValue,
        body: TakeQuote { 
            queryId: txContext.queryId, 
            initiator: txContext.initiator, 
            totalSupply: totalSupply, 
            totalAssets: totalAssets, 
            timestamp: blockchain.now(), 
            forwardPayload: forwardPayload,
        }
    });
    takeQuoteMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}