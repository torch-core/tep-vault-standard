tolk 1.0

import "storage"
import "constants/values";
import "constants/errors";
import "types/rounding";
import "types/asset";
import "messages/internal/schemas";
import "messages/internal/send";
import "role-authority/constants/type";
import "messages/external/emit";
import "types/response";

fun maxDeposit(depositAsset: Asset? = null) {
    return MAX_COINS_VALUE;
}

fun maxWithdraw(withdrawAsset: Asset? = null) {
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

fun handleWithdraw(sender: address, shares: coins, withdrawParams: VaultWithdrawFp, msgPayload: cell, withdrawAsset: Asset? = null) {
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

fun handleDeposit(
    inSenderAddress: address, 
    queryId: QueryId, 
    initiator: address, 
    depositAmount: coins, 
    depositParams: VaultDepositParams, 
    msgPayload: cell, 
    depositAsset: Asset? = null
) {
    try {
        val maxDepositAmount = maxDeposit(depositAsset);
        assert (depositAmount <= maxDepositAmount) throw ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED;

        val shares = previewDeposit(depositAmount, depositAsset);
        assert (shares >= depositParams.minMint) throw ERR_MIN_MINT_NOT_MET;

        mint(depositAmount, queryId, initiator, depositParams.receiver, shares, VaultStatus.Success(), depositParams.sucPayload, msgPayload);

        emitDeposited(initiator, depositParams.receiver, depositAmount, shares);
        return shares;
    } catch (e) {
        // If initiator is inSender, it's native deposit. Otherwise, it's a jetton deposit.
        if(inSenderAddress != initiator) {
            jettonTransfer(
                depositParams.receiver, 
                depositAmount, 
                queryId, 
                initiator, 
                depositAmount, 
                VaultStatus.Failure(ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED), 
                depositParams.failPayload, 
                msgPayload
            );
        } else {
            tonTransfer(
                inSenderAddress, 
                depositAmount, 
                queryId, 
                VaultStatus.Failure(ERR_MAX_DEPOSIT_AMOUNT_EXCEEDED), 
                depositParams.failPayload,
                msgPayload
            );
        }
        commitContractDataAndActions();
        throw e;
    }
}

fun withdrawAssets(sender: address, receiver: address, shares: coins, callbackParams: CallbackParams?, msgPayload: cell) {
    // TODO: Implement withdrawing
}