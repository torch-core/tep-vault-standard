import "constants/common-types"
import "constants/errors"
import "types/wallet-status"
import "types/asset"
import "messages/schemas/common"

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
    vaultState: VaultState
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

fun VaultStorage.mustGetJettonInfo(self) {
    if (self.externalAssetInfo == null) {
        throw ERR_MISSING_JETTON_INFO;
    }

    var externalAssetInfo = self.externalAssetInfo.load();
    if (!(externalAssetInfo is JettonInfo)) {
        throw ERR_MISSING_JETTON_INFO;
    }

    return externalAssetInfo;
}

fun VaultStorage.mustGetExtraCurrencyInfo(self) {
    if (self.externalAssetInfo == null) {
        throw ERR_MISSING_EXTRA_CURRENCY_INFO;
    }
    var externalAssetInfo = self.externalAssetInfo.load();
    if (!(externalAssetInfo is ExtraCurrencyInfo)) {
        throw ERR_MISSING_EXTRA_CURRENCY_INFO;
    }

    return externalAssetInfo;
}

// WARNING: If delta is negative, caller must ensure it doesn't exceed totalSupply or totalAssets
fun VaultStorage.updateSupplyAndAssets(mutate self, sharesDelta: int, assetsDelta: int) {
    self.vaultState.totalSupply = self.vaultState.totalSupply + sharesDelta;
    self.vaultState.totalAssets = self.vaultState.totalAssets + assetsDelta;
    self.save();
}

fun VaultStorage.setJettonWalletAddress(mutate self, senderAddress: address, jettonWalletAddress: address) {
    assert (self.externalAssetInfo != null) throw ERR_MISSING_JETTON_INFO;
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

