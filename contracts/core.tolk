import "constants/values";
import "constants/errors";
import "types/rounding";
import "types/asset"
import "types/callback-params"
import "storage"
import "messages/schemas/common"
import "messages/schemas/deposit"
import "messages/schemas/withdraw"
import "messages/send";
import "messages/emit";

fun totalAssets(vaultConfig: VaultConfig? = null) {
    var storage = lazy VaultStorage.load();
    return storage.vaultState.totalAssets;
}

fun convertToShares(assetAmount: coins, vaultConfig: VaultConfig? = null, rounding: RoundingType = RoundingType.Down) {
    var storage = lazy VaultStorage.load();
    val totalAssets = totalAssets();

    // First deposit: 1:1 ratio (assetAmount = shares), otherwise proportional calculation
    return totalAssets == 0 ? assetAmount : roundedMulDiv(assetAmount, storage.vaultState.totalSupply, totalAssets, rounding) as coins;
}

fun convertToAssets(shares: coins, vaultConfig: VaultConfig? = null, rounding: RoundingType = RoundingType.Down) {
    var storage = lazy VaultStorage.load();

    // No shares exist: 0 assets, otherwise proportional calculation
    return (storage.vaultState.totalSupply == 0 ? 0 : roundedMulDiv(shares, totalAssets(), storage.vaultState.totalSupply, rounding)) as coins;
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
fun handleDeposit(txContext: TxContext, depositAsset: Asset, depositAmount: coins, depositParams: DepositParams, vaultState: VaultState, assetJettonWallet: address? = null) {
    try {
        val maxDepositAmount = maxDeposit();
        assert (depositAmount <= maxDepositAmount) throw ERR_EXCEEDED_MAX_DEPOSIT;

        val shares = previewDeposit(depositAmount);
        assert (shares >= depositParams.minShares) throw ERR_FAILED_MIN_SHARES;

        mint(txContext, mutate depositParams.receiver, shares, SUCCESS_RESULT_CODE, resolveSuccessCallback(depositParams.callbacks.successCallback));
        emitDeposited(Deposited {
            initiator: txContext.initiator,
            receiver: depositParams.receiver,
            depositAsset: depositAsset.toCell(),
            depositAmount: depositAmount,
            shares: shares,
            vaultState: VaultState {
                totalSupply: vaultState.totalSupply + shares,
                totalAssets: vaultState.totalAssets + depositAmount
            }.toCell(),     
        });
        return shares;
    } catch (errCode) {
        transferAsset(TransferParams {
            asset: depositAsset,
            txContext: txContext, 
            transferAmount: depositAmount, 
            receiver: txContext.initiator, 
            resultCode: errCode, 
            callbackParams: resolveFailureCallback(depositParams.callbacks.failureCallback), 
            assetJettonWallet: assetJettonWallet,
        });   
        commitContractDataAndActions();
        throw errCode;
    }
}

// Handles withdrawal logic: validates, transfers assets to receiver, and emits event on success
// On failure, rolls back by minting shares back to initiator and throws error
fun handleWithdraw(txContext: TxContext, withdrawAsset: Asset, shares: coins, withdrawFp: WithdrawFp, vaultState: VaultState, assetJettonWallet: address? = null) {
    try {
        val maxShares = maxWithdraw();
        assert (shares <= maxShares) throw ERR_EXCEEDED_MAX_WITHDRAW;

        val withdrawAmount = previewWithdraw(shares);
        assert (withdrawAmount >= withdrawFp.minWithdraw) throw ERR_FAILED_MIN_WITHDRAW;
        
        transferAsset(TransferParams {
            asset: withdrawAsset,
            txContext: txContext, 
            transferAmount: withdrawAmount, 
            receiver: withdrawFp.receiver, 
            resultCode: SUCCESS_RESULT_CODE, 
            callbackParams: resolveSuccessCallback(withdrawFp.callbacks.successCallback), 
            assetJettonWallet: assetJettonWallet,
        });
        emitWithdrawn(Withdrawn {
            initiator: txContext.initiator,
            receiver: withdrawFp.receiver,
            withdrawAsset: withdrawAsset.toCell(),
            withdrawAmount: withdrawAmount,
            burnedShares: shares,
            vaultState: VaultState {
                totalSupply: vaultState.totalSupply - shares,
                totalAssets: vaultState.totalAssets - withdrawAmount
            }.toCell(),
        });
        return withdrawAmount;
    } catch (errCode) {
        mint(txContext, mutate txContext.initiator, shares, errCode, resolveFailureCallback(withdrawFp.callbacks.failureCallback));
        commitContractDataAndActions();
        throw errCode;
    }
}
