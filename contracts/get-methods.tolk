import "types/asset"
import "types/rounding"
import "storage"
import "helper/packAssets"
import "core"
import "messages/internal/schemas"

get fun getAsset() {
   val storage = lazy Storage.load();
   var assetsTuple: tuple = createEmptyTuple();
   assetsTuple.push(Asset.tonAsset().toCell());
   assetsTuple.push(Asset.jettonAsset(storage.assetJettonMaster!).toCell());

   return convertAssetsTupleToCell(assetsTuple, 0);
}

get fun getTotalAssets(optionalParams: OptionalVaultParams? = null) {
    return totalAssets();
}

get fun getConvertToShares(depositAmount: coins, optionalParams: OptionalVaultParams? = null) {
    return convertToShares(depositAmount, RoundingType.Down());
}

get fun getConvertToAssets(shares: coins, optionalParams: OptionalVaultParams? = null) {
    return convertToAssets(shares, RoundingType.Up());
}


get fun getMaxDeposit(optionalParams: OptionalVaultParams? = null) {
    return maxDeposit();
}

get fun getMaxWithdraw(optionalParams: OptionalVaultParams? = null) {
    return maxWithdraw();
}

get fun getPreviewDeposit(depositAmount: coins, optionalParams: OptionalVaultParams? = null) {
    return previewDeposit(depositAmount);
}

get fun getPreviewWithdraw(shares: coins, optionalParams: OptionalVaultParams? = null) {
    return previewWithdraw(shares);
}
