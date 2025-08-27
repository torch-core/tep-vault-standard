import "types/asset"
import "storage"
import "helper/packAssets"
import "helper/jetton"
import "messages/schemas/common"
import "messages/schemas/deposit"
import "messages/schemas/withdraw"
import "core"
import "fees-management"

get fun getAssets() {
    var assetsTuple: tuple = createEmptyTuple();
    val storage = lazy VaultStorage.load();
    if(storage.assetJettonInfo != null) {
        val assetJettonInfo = storage.assetJettonInfo!.load();
        assetsTuple.push(Asset.jettonAsset(assetJettonInfo.masterAddress!).toCell());
    }
    else {
        assetsTuple.push(Asset.tonAsset().toCell());
    }

    return convertAssetsTupleToCell(assetsTuple, 0);
}

get fun getTotalAssets(vaultOptionsCell: Cell<VaultOptions>? = null) {
    return totalAssets();
}

get fun getConvertToShares(assetAmount: coins, vaultOptionsCell: Cell<VaultOptions>? = null) {
    return convertToShares(assetAmount);
}

get fun getConvertToAssets(shares: coins, vaultOptionsCell: Cell<VaultOptions>? = null) {
    return convertToAssets(shares);
}


get fun getMaxDeposit(depositOptionsCell: Cell<DepositOptions>? = null) {
    return maxDeposit();
}

get fun getMaxWithdraw(withdrawOptionsCell: Cell<WithdrawOptions>? = null) {
    return maxWithdraw();
}

get fun getPreviewDeposit(depositAmount: coins, depositOptionsCell: Cell<DepositOptions>? = null) {
    return previewDeposit(depositAmount);
}

get fun getPreviewWithdraw(shares: coins, withdrawOptionsCell: Cell<WithdrawOptions>? = null) {
    return previewWithdraw(shares);
}

get fun getPreviewTonDepositFee() {
    return previewTonDepositFee();
}

get fun getPreviewJettonDepositFee() {
    return previewJettonDepositFee();
}

get fun getPreviewWithdrawFee() {
    return previewWithdrawFee();
}

get fun getPreviewProvideQuoteFee() {
    return previewProvideQuoteFee();
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
    val storage = lazy VaultStorage.load();

    return {
        totalSupply: storage.totalSupply,
        mintable: true,
        adminAddress: storage.adminAddress,
        jettonContent: storage.content,
        jettonWalletCode: storage.jettonWalletCode,
    }
}

get fun get_wallet_address(ownerAddress: address): address {
    val storage = lazy VaultStorage.load();
    val addrBuilt = buildAddressOfJettonWallet(ownerAddress, contract.getAddress(), storage.jettonWalletCode);
    return address.fromValidBuilder(addrBuilt);
}
