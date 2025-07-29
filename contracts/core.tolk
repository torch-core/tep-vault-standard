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

fun maxDeposit(optionalParams: OptionalVaultParams? = null) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(optionalParams: OptionalVaultParams? = null) {
    return MAX_COINS_VALUE;
}

fun totalAssets(optionalParams: OptionalVaultParams? = null) {
    var storage = lazy VaultStorage.load();
    return storage.totalAssets;
}

fun convertToShares(depositAmount: coins, rounding: RoundingType, optionalParams: OptionalVaultParams? = null) {
    var storage = lazy VaultStorage.load();
    return roundedMulDiv(depositAmount, storage.totalSupply, totalAssets(), rounding) as coins;
}

fun convertToAssets(shares: coins, rounding: RoundingType, optionalParams: OptionalVaultParams? = null) {
    var storage = lazy VaultStorage.load();
    return roundedMulDiv(shares, totalAssets(), storage.totalSupply, rounding) as coins;
}

fun previewDeposit(depositAmount: coins, optionalParams: OptionalVaultParams? = null) {
    return convertToShares(depositAmount, RoundingType.Down());
}

fun previewWithdraw(shares: coins, optionalParams: OptionalVaultParams? = null) {
    return convertToAssets(shares, RoundingType.Up());
}

fun handleDeposit(
    initiator: address, 
    queryId: QueryId, 
    remainingValue: coins,
    senderAddress: address, 
    depositAmount: coins, 
    depositParams: VaultDepositParams, 
    inMsg: cell
) {
    try {
        val maxDepositAmount = maxDeposit();
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount);
        assert (shares >= depositParams.minShares!) throw ERR_MIN_SHARES_NOT_MET;

        mint(initiator, queryId, remainingValue, depositParams.receiver, shares, VaultResult.Success(), depositParams.vaultCallbacks.successCallback, inMsg);
        emitDeposited(initiator, depositParams.receiver, depositAmount, shares);
        return shares;
    } catch (e) {
        if (initiator == senderAddress) {
            tonTransfer(initiator, queryId, remainingValue, depositParams.receiver, VaultResult.Error(e), depositParams.vaultCallbacks.failureCallback, inMsg);
        } else {
            jettonTransfer(
                initiator, 
                queryId, 
                remainingValue, 
                senderAddress, 
                depositParams.receiver,
                depositAmount, 
                VaultResult.Error(e), 
                depositParams.vaultCallbacks.failureCallback, 
                inMsg
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
    withdrawParams: VaultWithdrawFp, 
    inMsg: cell, 
    assetJettonWallet: address? = null
) {
    try {
        val maxWithdrawShares = maxWithdraw();
        assert (shares <= maxWithdrawShares) throw ERR_MAX_WITHDRAW_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares);
        assert (withdrawAmount >= withdrawParams.minWithdraw!) throw ERR_MIN_WITHDRAW_NOT_MET;

        if (assetJettonWallet == null) {
            tonTransfer(initiator, queryId, remainingValue, withdrawParams.receiver, VaultResult.Success(), withdrawParams.vaultCallbacks.successCallback, inMsg);
        } else {
            jettonTransfer(
                initiator, 
                queryId, 
                remainingValue, 
                assetJettonWallet, 
                withdrawParams.receiver, 
                withdrawAmount, 
                VaultResult.Success(), 
                withdrawParams.vaultCallbacks.successCallback, 
                inMsg
            );
        }

        emitWithdrawn(initiator, withdrawParams.receiver, withdrawAmount, shares);
        return withdrawAmount;
    } catch (e) {
        mint(initiator, queryId, remainingValue, initiator, shares, VaultResult.Error(e), withdrawParams.vaultCallbacks.failureCallback, inMsg);
        commitContractDataAndActions();
        throw e;
    }
}
