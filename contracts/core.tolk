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

fun maxDeposit(depositAsset: Asset? = null) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(withdrawAsset: Asset? = null) {
    return MAX_COINS_VALUE;
}

fun totalAssets() {
    var storage = lazy Storage.load();
    return storage.totalAssets;
}

fun convertToShares(depositAmount: coins, rounding: RoundingType, depositAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(depositAmount, storage.totalSupply, totalAssets(), rounding) as coins;
}

fun convertToAssets(shares: coins, rounding: RoundingType, withdrawAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(shares, totalAssets(), storage.totalSupply, rounding) as coins;
}

fun previewDeposit(depositAmount: coins, depositAsset: Asset? = null) {
    return convertToShares(depositAmount, RoundingType.Down(), depositAsset);
}

fun previewWithdraw(shares: coins, withdrawAsset: Asset? = null) {
    return convertToAssets(shares, RoundingType.Up(), withdrawAsset);
}

fun handleDeposit(
    initiator: address, 
    queryId: QueryId, 
    sendingValue: coins,
    senderAddress: address, 
    depositAmount: coins, 
    depositParams: VaultDepositParams, 
    inMsgPayload: cell, 
    depositAsset: Asset? = null
) {
    try {
        val maxDepositAmount = maxDeposit(depositAsset);
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount, depositAsset);
        assert (shares >= depositParams.minShares!) throw ERR_MIN_SHARES_NOT_MET;

        mint(initiator, queryId, sendingValue, depositParams.receiver!, shares, VaultResult.Success(), depositParams.successPayload, inMsgPayload);
        emitDeposited(initiator, depositParams.receiver!, depositAmount, shares);
        return shares;
    } catch (e) {
        transferAsset(
            initiator,
            queryId,
            sendingValue,
            AssetType.jetton(), // Use AssetType.ton() for TON Deposit
            senderAddress,   // Use null for TON Deposit
            depositParams.receiver!,
            depositAmount,
            VaultResult.Failure(e),
            depositParams.failurePayload,
            inMsgPayload
        );
        commitContractDataAndActions();
        throw e;
    }
}

fun handleWithdraw(
    initiator: address, 
    queryId: QueryId, 
    sendingValue: coins, 
    shares: coins, 
    withdrawParams: VaultWithdrawFp, 
    inMsgPayload: cell, 
    withdrawAssetJettonWallet: address? = null, 
    withdrawAsset: Asset? = null
) {
    try {
        val maxWithdrawShares = maxWithdraw(withdrawAsset);
        assert (shares <= maxWithdrawShares) throw ERR_MAX_WITHDRAW_AMOUNT_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares, withdrawAsset);
        assert (withdrawAmount >= withdrawParams.minWithdraw!) throw ERR_MIN_WITHDRAW_NOT_MET;

        transferAsset(
            initiator,
            queryId,
            sendingValue,
            AssetType.jetton(),             // Use AssetType.ton() for TON Withdrawal, or withdrawAsset type to determine the asset type(multi-asset vault)
            withdrawAssetJettonWallet,   // Use null for TON Withdrawal
            withdrawParams.receiver!,
            withdrawAmount,
            VaultResult.Success(),
            withdrawParams.successPayload,
            inMsgPayload
        );
        emitWithdrawn(initiator, withdrawParams.receiver!, withdrawAmount, shares);
        return withdrawAmount;
    } catch (e) {
        mint(initiator, queryId, shares, initiator, shares, VaultResult.Failure(e), withdrawParams.failurePayload, inMsgPayload);
        commitContractDataAndActions();
        throw e;
    }
}
