import "types/asset"
import "types/rounding"
import "storage"
import "helper/packAssets"
import "core"

get fun getAsset() {
   val storage = lazy Storage.load();
   var assetsTuple: tuple = createEmptyTuple();
   assetsTuple.push(Asset.tonAsset().toCell());
   assetsTuple.push(Asset.jettonAsset(storage.assetJettonMaster!).toCell());

   return convertAssetsTupleToCell(assetsTuple, 0);
}

get fun getTotalAssets(optionalPayload: cell? = null) {
    return totalAssets();
}

get fun getConvertToShares(depositAmount: coins, optionalPayload: cell? = null, depositAsset: Asset? = null) {
    return convertToShares(depositAmount, RoundingType.Down());
}

get fun getConvertToAssets(shares: coins, optionalPayload: cell? = null, withdrawAsset: Asset? = null) {
    return convertToAssets(shares, RoundingType.Up());
}


get fun getMaxDeposit(optionalPayload: cell? = null, depositAsset: Asset? = null) {
    return maxDeposit();
}

get fun getMaxWithdraw(optionalPayload: cell? = null, withdrawAsset: Asset? = null) {
    return maxWithdraw();
}

get fun getPreviewDeposit(depositAmount: coins, optionalPayload: cell? = null, depositAsset: Asset? = null) {
    return previewDeposit(depositAmount);
}

get fun getPreviewWithdraw(shares: coins, optionalPayload: cell? = null, withdrawAsset: Asset? = null) {
    return previewWithdraw(shares);
}
