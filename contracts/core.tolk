import "constants/values";
import "constants/errors";
import "constants/common-types";
import "types/rounding";
import "types/asset";
import "types/vault-result";
import "storage"
import "messages/internal/schemas";
import "messages/internal/send";
import "messages/external/emit";
import "messages/external/schemas"

fun maxDeposit(optionalParams: OptionalParams? = null) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(optionalParams: OptionalParams? = null) {
    return MAX_COINS_VALUE;
}

fun totalAssets(optionalParams: OptionalParams? = null) {
    var storage = lazy VaultStorage.load();
    return storage.totalAssets;
}

fun convertToShares(depositAmount: coins, rounding: RoundingType, optionalParams: OptionalParams? = null) {
    var storage = lazy VaultStorage.load();
    return storage.totalSupply == 0 ? depositAmount : roundedMulDiv(depositAmount, storage.totalSupply, totalAssets(), rounding) as coins;
}

fun convertToAssets(shares: coins, rounding: RoundingType, optionalParams: OptionalParams? = null) {
    var storage = lazy VaultStorage.load();
    return roundedMulDiv(shares, totalAssets(), storage.totalSupply, rounding) as coins;
}

fun previewDeposit(depositAmount: coins, optionalParams: OptionalParams? = null) {
    return convertToShares(depositAmount, RoundingType.Down());
}

fun previewWithdraw(shares: coins, optionalParams: OptionalParams? = null) {
    return convertToAssets(shares, RoundingType.Up());
}

fun handleDeposit(
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins,
    senderAddress: address, 
    depositAmount: coins, 
    depositParams: DepositParams, 
    inBody: slice
) {
    try {
        val maxDepositAmount = maxDeposit();
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount);
        assert (shares >= depositParams.minShares!) throw ERR_MIN_SHARES_NOT_MET;

        mint(initiator, queryId, remainingValue, mutate depositParams.receiver, shares, Result.Success(), depositParams.callbacks.successCallback, inBody);
        emitDeposited(Deposited { initiator: initiator, receiver: depositParams.receiver, depositAmount: depositAmount, shares: shares });
        return shares;
    } catch (e) {
        if (initiator == senderAddress) {
            tonTransfer(initiator, queryId, remainingValue + depositAmount, initiator, Result.Error(e), depositParams.callbacks.failureCallback, inBody);
        } else {
            jettonTransfer(
                initiator, 
                queryId, 
                remainingValue, 
                senderAddress, 
                depositParams.receiver,
                depositAmount, 
                Result.Error(e), 
                depositParams.callbacks.failureCallback, 
                inBody
            );
        }
        commitContractDataAndActions();
        throw e;
    }
}

fun handleWithdraw(
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins, 
    shares: coins, 
    withdrawParamsFp: WithdrawParamsFp, 
    inBody: slice, 
    assetJettonWallet: address? = null
) {
    try {
        val maxWithdrawShares = maxWithdraw();
        assert (shares <= maxWithdrawShares) throw ERR_MAX_WITHDRAW_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares);
        assert (withdrawAmount >= withdrawParamsFp.minWithdraw!) throw ERR_MIN_WITHDRAW_NOT_MET;

        if (assetJettonWallet == null) {
            tonTransfer(initiator, queryId, remainingValue, withdrawParamsFp.receiver, Result.Success(), withdrawParamsFp.callbacks.successCallback, inBody);
        } else {
            jettonTransfer(
                initiator, 
                queryId, 
                remainingValue, 
                assetJettonWallet, 
                withdrawParamsFp.receiver, 
                withdrawAmount, 
                Result.Success(), 
                withdrawParamsFp.callbacks.successCallback, 
                inBody
            );
        }
        emitWithdrawn(Withdrawn { initiator: initiator, receiver: withdrawParamsFp.receiver, withdrawAmount: withdrawAmount, shares: shares });
        return withdrawAmount;
    } catch (e) {
        mint(initiator, queryId, remainingValue, mutate initiator, shares, Result.Error(e), withdrawParamsFp.callbacks.failureCallback, inBody);
        commitContractDataAndActions();
        throw e;
    }
}
