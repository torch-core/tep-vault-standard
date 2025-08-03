import "constants/values";
import "constants/errors";
import "constants/common-types";
import "types/rounding";
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

fun convertToShares(depositAmount: coins, optionalParams: OptionalParams? = null, rounding: RoundingType = ROUND_DOWN) {
    var storage = lazy VaultStorage.load();
    val totalAssets = totalAssets();
    return totalAssets == 0 ? depositAmount : roundedMulDiv(depositAmount, storage.totalSupply, totalAssets, rounding) as coins;
}

fun convertToAssets(shares: coins, optionalParams: OptionalParams? = null, rounding: RoundingType = ROUND_DOWN) {
    var storage = lazy VaultStorage.load();
    return (storage.totalSupply == 0 ? 0 : roundedMulDiv(shares, totalAssets(), storage.totalSupply, rounding)) as coins;
}

fun previewDeposit(depositAmount: coins, optionalParams: OptionalParams? = null) {
    return convertToShares(depositAmount);
}

fun previewWithdraw(shares: coins, optionalParams: OptionalParams? = null) {
    return convertToAssets(shares);
}

fun handleDeposit(initiator: address, queryId: QueryId, remainingValue: coins, senderAddress: address, depositAmount: coins, depositParams: DepositParams, inBody: slice) {
    try {
        val maxDepositAmount = maxDeposit();
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount);
        assert (shares >= depositParams.minShares!) throw ERR_MIN_SHARES_NOT_MET;

        mint(initiator, queryId, remainingValue, mutate depositParams.receiver, shares, Result.Success(), depositParams.callbacks.successCallback, inBody);
        emitDeposited(Deposited { initiator: initiator, receiver: depositParams.receiver, depositAmount: depositAmount, shares: shares });
        return shares;
    } catch (e) {
        transferAsset(
            initiator == senderAddress,
            initiator, 
            queryId, 
            remainingValue, 
            depositAmount, 
            initiator, 
            Result.Error(e), 
            depositParams.callbacks.failureCallback, 
            inBody, 
            senderAddress
        );   
        commitContractDataAndActions();
        throw e;
    }
}

fun handleWithdraw(initiator: address, queryId: QueryId, remainingValue: coins, shares: coins, withdrawFp: WithdrawFp, inBody: slice, assetJettonWallet: address? = null) {
    try {
        val maxShares = maxWithdraw();
        assert (shares <= maxShares) throw ERR_MAX_WITHDRAW_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares);
        assert (withdrawAmount >= withdrawFp.minWithdraw!) throw ERR_MIN_WITHDRAW_NOT_MET;
        
        transferAsset(
            assetJettonWallet == null,
            initiator, 
            queryId, 
            remainingValue, 
            withdrawAmount, 
            withdrawFp.receiver, 
            Result.Success(), 
            withdrawFp.callbacks.successCallback, 
            inBody, 
            assetJettonWallet
        );
        emitWithdrawn(Withdrawn { initiator: initiator, receiver: withdrawFp.receiver, withdrawAmount: withdrawAmount, burnedShares: shares });
        return withdrawAmount;
    } catch (e) {
        mint(initiator, queryId, remainingValue, mutate initiator, shares, Result.Error(e), withdrawFp.callbacks.failureCallback, inBody);
        commitContractDataAndActions();
        throw e;
    }
}
