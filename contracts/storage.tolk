import "constants/common-types"
import "constants/errors"
import "types/wallet-status"
import "types/asset"

// ==== Vault Storage ====
struct (0x1) JettonInfo {
    masterAddress: address
    walletAddress: address
}

struct (0x2) ExtraCurrencyInfo {
    extraCurrencyId: ExtraCurrencyId
}

type ExternalAssetInfo = JettonInfo | ExtraCurrencyInfo

struct VaultStorage {
    adminAddress: address
    totalSupply: coins
    totalAssets: coins
    externalAssetInfo: Cell<ExternalAssetInfo>?
    jettonWalletCode: cell
    content: cell
}

fun VaultStorage.load() {
    return VaultStorage.fromCell(contract.getData())
}

fun VaultStorage.save(self) {
    contract.setData(self.toCell())
}

fun VaultStorage.getAsset(self): Asset {
    if (self.externalAssetInfo == null) {
        return Asset.tonAsset();
    }
    var externalAssetInfo = self.externalAssetInfo.load();
    return (externalAssetInfo is JettonInfo) 
        ? Asset.jettonAsset(externalAssetInfo.masterAddress) 
        : Asset.extraCurrencyAsset(externalAssetInfo.extraCurrencyId);
}

fun VaultStorage.getAssetJettonInfo(self) {
    if (self.externalAssetInfo == null) {
        return null;
    }
    var externalAssetInfo = self.externalAssetInfo.load();
    return (externalAssetInfo is JettonInfo) ? externalAssetInfo : null;
}

fun VaultStorage.getExtraCurrencyInfo(self) {
    if (self.externalAssetInfo == null) {
        return null;
    }
    var externalAssetInfo = self.externalAssetInfo.load();
    return (externalAssetInfo is ExtraCurrencyInfo) ? externalAssetInfo : null;
}

fun VaultStorage.updateSupplyAndAssets(mutate self, sharesDelta: coins, assetsDelta: coins) {
    self.totalSupply = self.totalSupply + sharesDelta;
    self.totalAssets = self.totalAssets + assetsDelta;
    self.save();
}

fun VaultStorage.SetJettonWalletAddress(mutate self, senderAddress: address, jettonWalletAddress: address) {
    assert (self.externalAssetInfo != null) throw ERR_MISSING_ASSET_JETTON_INFO;
    var externalAssetInfo = self.externalAssetInfo.load();
    if (externalAssetInfo is JettonInfo) {
        assert (senderAddress == externalAssetInfo.masterAddress) throw ERR_INVALID_JETTON_MASTER; 
        externalAssetInfo.walletAddress = jettonWalletAddress;
    }
    self.externalAssetInfo = externalAssetInfo.toCell();
    self.save();
}

// ==== Jetton Wallet Storage ====
struct WalletStorage {
    status: WalletStatus
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

