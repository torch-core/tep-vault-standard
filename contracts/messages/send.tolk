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

fun mint(initiator: address, queryId: QueryId, remainingValue: coins, mutate receiver: address, shares: coins, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    assert (shares > 0) throw ERR_INVALID_TRANSFER_AMOUNT;
    
    receiver = resolveReceiver(receiver, initiator);
    val storage = lazy VaultStorage.load();
    val minterAddress = contract.getAddress();
    val mintMsg = createMessage({
        bounce: false,
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
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    receiver = resolveReceiver(receiver, initiator);
    val transferMsg = createMessage({
        bounce: false,
        dest: jettonWallet,
        value: remainingValue,
        body: AskToTransfer {
            queryId: queryId,
            jettonAmount: transferAmount,
            transferRecipient: receiver,
            sendExcessesTo: initiator,
            customPayload: null,
            forwardTonAmount: calcForwardTonAmount(callbackParams, remainingValue),
            forwardPayload: createForwardPayload(result, initiator, callbackParams, inBody)
        },
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun tonTransfer(initiator: address, queryId: QueryId, sendingValue: coins, receiver: address, result: Result, callbackParams: Cell<CallbackParams>?, inBody: slice) {
    assert (sendingValue > 0) throw ERR_INVALID_TRANSFER_AMOUNT;
    
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

fun extraCurrencyTransfer(
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins, 
    extraCurrencyId: ExtraCurrencyId, 
    receiver: address, 
    transferAmount: coins, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
    inBody: slice
) {
    assert (transferAmount > 0) throw ERR_INVALID_TRANSFER_AMOUNT;

    var extraCurrencyDict = createEmptyDict();
    extraCurrencyDict.uDictSetBuilder(EXTRA_CURRENCY_ID_SIZE, extraCurrencyId, beginCell().storeEcValue(transferAmount));
    val transferMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, initiator),
        value: (remainingValue, extraCurrencyDict),
        body: VaultNotificationEc {
            queryId: queryId,
            vaultNotificationParams: createVaultNotificationParams(result, initiator, callbackParams, inBody)
        }
    });
    transferMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun transferAsset(
    transferAsset: Asset,
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins, 
    transferAmount: coins,
    receiver: address, 
    result: Result, 
    callbackParams: Cell<CallbackParams>?, 
    inBody: slice,
) {
    match (transferAsset) {
        TonAsset => {
            tonTransfer(initiator, queryId, remainingValue + transferAmount, receiver, result, callbackParams, inBody);
        }
        JettonAsset => {
            val storage = lazy VaultStorage.load();
            val assetJettonWallet = storage.getAssetJettonWallet();
            assert (assetJettonWallet != null) throw ERR_MISSING_ASSET_JETTON_WALLET;
            jettonTransfer(initiator, queryId, remainingValue, assetJettonWallet!, receiver, transferAmount, result, callbackParams, inBody);
        }
        ExtraCurrencyAsset => {
            extraCurrencyTransfer(initiator, queryId, remainingValue, transferAsset.extraCurrencyId, receiver, transferAmount, result, callbackParams, inBody);
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

fun sendTakeQuote(initiator: address, queryId: QueryId, remainingValue: coins, quoteAsset: Asset, receiver: address, totalSupply: coins, totalAssets: coins, forwardPayload: cell?) {
    val takeQuoteMsg = createMessage({
        bounce: false,
        dest: resolveReceiver(receiver, initiator),
        value: remainingValue,
        body: TakeQuote { 
            queryId: queryId, 
            initiator: initiator, 
            quoteAsset: quoteAsset.toCell(),
            totalSupply: totalSupply, 
            totalAssets: totalAssets, 
            timestamp: blockchain.now(), 
            forwardPayload: forwardPayload,
        }
    });
    takeQuoteMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}