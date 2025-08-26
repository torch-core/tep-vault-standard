import "constants/values";
import "constants/errors";
import "constants/common-types";
import "types/rounding";
import "types/vault-result";
import "types/asset"
import "storage"
import "messages/send";
import "messages/emit";
import "messages/schemas/common"
import "messages/schemas/deposit"
import "messages/schemas/withdraw"
fun totalAssets(vaultConfig: VaultConfig? = null) {
    var storage = lazy VaultStorage.load();
    return storage.totalAssets;
}

fun convertToShares(depositAmount: coins, depositConfig: DepositConfig? = null, rounding: RoundingType = ROUND_DOWN) {
    var storage = lazy VaultStorage.load();
    val totalAssets = totalAssets();

    // First deposit: 1:1 ratio (depositAmount = shares), otherwise proportional calculation
    return totalAssets == 0 ? depositAmount : roundedMulDiv(depositAmount, storage.totalSupply, totalAssets, rounding) as coins;
}

fun convertToAssets(shares: coins, withdrawConfig: WithdrawConfig? = null, rounding: RoundingType = ROUND_DOWN) {
    var storage = lazy VaultStorage.load();

    // No shares exist: 0 assets, otherwise proportional calculation
    return (storage.totalSupply == 0 ? 0 : roundedMulDiv(shares, totalAssets(), storage.totalSupply, rounding)) as coins;
}

fun maxDeposit(depositConfig: DepositConfig? = null) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(withdrawConfig: WithdrawConfig? = null) {
    return MAX_COINS_VALUE;
}

fun previewDeposit(depositAmount: coins, depositConfig: DepositConfig? = null) {
    return convertToShares(depositAmount);
}

fun previewWithdraw(shares: coins, withdrawConfig: WithdrawConfig? = null) {
    return convertToAssets(shares);
}

// Handles deposit logic: validates, mints shares to receiver, and emits event on success
// On failure, rolls back by transferring asset(TON or Jetton) back to initiator and throws error
fun handleDeposit(initiator: address, queryId: QueryId, remainingValue: coins, senderAddress: address, depositAmount: coins, depositParams: DepositParams, inBody: slice) {
    try {
        val maxDepositAmount = maxDeposit();
        assert (depositAmount <= maxDepositAmount) throw ERR_EXCEEDED_MAX_DEPOSIT;

        val shares = previewDeposit(depositAmount);
        assert (shares >= depositParams.minShares!) throw ERR_FAILED_MIN_SHARES;

        mint(initiator, queryId, remainingValue, mutate depositParams.receiver, shares, Result.Success(), depositParams.callbacks.successCallback, inBody);
        emitDeposited(Deposited { initiator: initiator, receiver: depositParams.receiver, depositAmount: depositAmount, shares: shares });
        return shares;
    } catch (errCode) {
        transferAsset(
            initiator == senderAddress, // If true -> transfer asset is TON, otherwise transfer asset is Jetton (senderAddress is vault jetton wallet instead of initiator)
            initiator, 
            queryId, 
            remainingValue, 
            depositAmount, 
            initiator, 
            Result.Error(errCode), 
            depositParams.callbacks.failureCallback, 
            inBody, 
            senderAddress
        );   
        commitContractDataAndActions();
        throw errCode;
    }
}

// Handles withdrawal logic: validates, transfers assets to receiver, and emits event on success
// On failure, rolls back by minting shares back to initiator and throws error
fun handleWithdraw(initiator: address, queryId: QueryId, remainingValue: coins, shares: coins, withdrawFp: WithdrawFp, inBody: slice, assetJettonWallet: address? = null) {
    try {
        val maxShares = maxWithdraw();
        assert (shares <= maxShares) throw ERR_EXCEEDED_MAX_WITHDRAW;

        val withdrawAmount = previewWithdraw(shares);
        assert (withdrawAmount >= withdrawFp.minWithdraw!) throw ERR_FAILED_MIN_WITHDRAW;
        
        transferAsset(
            assetJettonWallet == null, // If true -> transfer asset is TON, otherwise transfer asset is Jetton
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
    } catch (errCode) {
        mint(initiator, queryId, remainingValue, mutate initiator, shares, Result.Error(errCode), withdrawFp.callbacks.failureCallback, inBody);
        commitContractDataAndActions();
        throw errCode;
    }
}
