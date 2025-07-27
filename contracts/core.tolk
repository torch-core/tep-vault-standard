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
    return roundedMulDiv(depositedAmount, storage.totalSupply, storage.totalAssets, rounding) as coins;
}

fun convertToAssets(shares: coins, rounding: RoundingType, withdrawAsset: Asset? = null) {
    var storage = lazy Storage.load();
    return roundedMulDiv(shares, storage.totalAssets, storage.totalSupply, rounding) as coins;
}

// depositAsset is for multi-asset vaults
fun previewDeposit(depositAmount: coins, depositAsset: Asset? = null) {
    return convertToShares(depositAmount, RoundingType.Down(), depositAsset);
}

fun previewWithdraw(shares: coins, withdrawAsset: Asset? = null) {
    return convertToAssets(shares, RoundingType.Up(), withdrawAsset);
}

fun handleDeposit(
    inSenderAddress: address, 
    queryId: QueryId, 
    sendingValue: coins,
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
        assert (shares >= depositParams.minMint!) throw ERR_MIN_MINT_NOT_MET;

        mint(depositAmount, queryId, initiator, depositParams.receiver!, shares, VaultStatus.Success(), depositParams.sucPayload, msgPayload);
        emitDeposited(initiator, depositParams.receiver!, depositAmount, shares);
        return shares;
    } catch (e) {
        // If initiator is inSender, it's native deposit. Otherwise, it's a jetton deposit.
        if(inSenderAddress != initiator) {
            jettonTransfer(
                inSenderAddress, 
                sendingValue, 
                queryId, 
                initiator, 
                depositParams.receiver!,
                depositAmount, 
                VaultStatus.Failure(e), 
                depositParams.failPayload, 
                msgPayload
            );
        }
        tonTransfer(inSenderAddress, sendingValue, queryId, VaultStatus.Failure(e), depositParams.failPayload, msgPayload);
        commitContractDataAndActions();
        throw e;
    }
}


fun handleWithdraw(
    queryId: QueryId, 
    sendingValue: coins, 
    initiator: address, 
    shares: coins, 
    withdrawParams: VaultWithdrawFp, 
    msgPayload: cell, 
    withdrawAssetJettonWallet: address? = null, 
    withdrawAsset: Asset? = null
) {
    try {
        val maxWithdrawShares = maxWithdraw(withdrawAsset);
        assert (shares <= maxWithdrawShares) throw ERR_MAX_WITHDRAW_AMOUNT_EXCEEDED;

        val withdrawAmount = previewWithdraw(shares, withdrawAsset);
        assert (withdrawAmount >= withdrawParams.minWithdraw!) throw ERR_MIN_WITHDRAW_NOT_MET;

        withdraw(initiator, withdrawAmount, queryId, withdrawAsset, withdrawAssetJettonWallet, sendingValue, withdrawParams, msgPayload);
        emitWithdrawn(initiator, withdrawParams.receiver!, withdrawAmount, shares);
        return withdrawAmount;
    } catch (e) {
        mint(shares, queryId, initiator, initiator, shares, VaultStatus.Failure(e), withdrawParams.failPayload, msgPayload);
        commitContractDataAndActions();
        throw e;
    }
}
