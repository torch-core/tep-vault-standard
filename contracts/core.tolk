tolk 1.0

import "storage"
import "constants/values";
import "constants/errors";
import "types/rounding";
import "types/asset";
import "int-messages";

fun maxDeposit(depositAsset: Asset) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(withdrawAsset: Asset) {
    return MAX_COINS_VALUE;
}

fun convertToShares(depositedAmount: coins, rounding: RoundingType, depositAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(depositedAmount, storage.totalSupply, storage.totalAssets, rounding);
}

fun convertToAssets(shares: coins, rounding: RoundingType, withdrawAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(shares, storage.totalAssets, storage.totalSupply, rounding);
}

// depositAsset is for multi-asset vaults
fun previewDeposit(depositAmount: coins, depositAsset: Asset? = null) {
    return convertToShares(depositAmount, RoundingType.Down(), depositAsset);
}

fun previewWithdraw(shares: coins, withdrawAsset: Asset? = null) {
    return convertToAssets(shares, RoundingType.Up(), withdrawAsset);
}

fun handleWithdraw(sender: address, shares: coins, withdrawParams: VaultWithdrawFp, msgPayload: cell, withdrawAsset: Asset) {
    try {
        val maxWithdrawAmount = maxWithdraw(withdrawAsset);
        assert (shares <= maxWithdrawAmount) throw ERR_MAX_WITHDRAW_AMOUNT_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares, withdrawAsset);
        assert (withdrawAmount >= withdrawParams.minWithdraw) throw ERR_MIN_WITHDRAW_NOT_MET;

        withdrawAssets(sender, withdrawParams.receiver, shares, withdrawParams.sucPayload, msgPayload);

        return withdrawAmount;
    } catch (e) {
        // TODO: Send error message to receiver with failPayload
        commitContractDataAndActions();
        throw e;
    }
}

fun handleDeposit(sender: address, depositAmount: coins, depositParams: VaultDepositParams, msgPayload: cell, depositAsset: Asset) {
    try {
        val maxDepositAmount = maxDeposit(depositAsset);
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount, depositAsset);
        assert (shares >= depositParams.minMint) throw ERR_MIN_MINT_NOT_MET;

        mintShares(sender, depositParams.receiver, shares, depositParams.sucPayload, msgPayload);

        //TODO: Emit deposit event
        return shares;
    } catch (e) {
        // TODO Send error message to receiver with failPayload
        commitContractDataAndActions();
        throw e;
    }
}

fun mintShares(sender: address, receiver: address, shares: coins, callbackParams: CallbackParams?, msgPayload: cell) {
    // TODO: Implement minting
}

fun withdrawAssets(sender: address, receiver: address, shares: coins, callbackParams: CallbackParams?, msgPayload: cell) {
    // TODO: Implement withdrawing
}