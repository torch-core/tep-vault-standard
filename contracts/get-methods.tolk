import "types/asset"
import "types/rounding"
import "storage"
import "helper/packAssets"
import "core"
import "messages/internal/schemas"
import "helper/jetton"
import "fees-management"

get fun getAsset() {
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

get fun getTotalAssets(vaultOptions: VaultOptions? = null) {
    return totalAssets();
}

get fun getConvertToShares(depositAmount: coins, depositOptions: DepositOptions? = null) {
    return convertToShares(depositAmount);
}

get fun getConvertToAssets(shares: coins, withdrawOptions: WithdrawOptions? = null) {
    return convertToAssets(shares);
}


get fun getMaxDeposit(depositOptions: DepositOptions? = null) {
    return maxDeposit();
}

get fun getMaxWithdraw(withdrawOptions: WithdrawOptions? = null) {
    return maxWithdraw();
}

get fun getPreviewDeposit(depositAmount: coins, depositOptions: DepositOptions? = null) {
    return previewDeposit(depositAmount);
}

get fun getPreviewWithdraw(shares: coins, withdrawOptions: WithdrawOptions? = null) {
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
