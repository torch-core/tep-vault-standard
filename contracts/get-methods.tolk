import "types/asset"
import "types/rounding"
import "storage"
import "helper/packAssets"
import "core"
import "messages/internal/schemas"
import "helper/jetton"

get fun getAsset() {
    var assetsTuple: tuple = createEmptyTuple();
    val storage = lazy Storage.load();
    if(storage.assetJettonInfo != null) {
        val assetJettonInfo = storage.assetJettonInfo!.load();
        assetsTuple.push(Asset.jettonAsset(assetJettonInfo.masterAddress!).toCell());
    }
    else {
        assetsTuple.push(Asset.tonAsset().toCell());
    }

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

// For Jetton

struct JettonDataReply {
    totalSupply: int
    mintable: bool
    adminAddress: address
    jettonContent: cell
    jettonWalletCode: cell
}

get fun get_jetton_data(): JettonDataReply {
    val storage = lazy Storage.load();

    return {
        totalSupply: storage.totalSupply,
        mintable: true,
        adminAddress: storage.adminAddress,
        jettonContent: storage.content,
        jettonWalletCode: storage.jettonWalletCode,
    }
}

get fun get_wallet_address(ownerAddress: address): address {
    val storage = lazy Storage.load();
    val addrBuilt = buildAddressOfJettonWallet(ownerAddress, contract.getAddress(), storage.jettonWalletCode);
    return address.fromValidBuilder(addrBuilt);
}
