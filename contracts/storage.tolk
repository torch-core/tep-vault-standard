import "constants/common-types"
import "constants/errors"
import "types/wallet-status"

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

fun VaultStorage.updateSupplyAndAssets(mutate self, sharesDelta: coins, assetsDelta: coins) {
    self.totalSupply = self.totalSupply + sharesDelta;
    self.totalAssets = self.totalAssets + assetsDelta;
    self.save();
}

fun VaultStorage.SetJettonWalletAddress(mutate self, senderAddress: address, jettonWalletAddress: address) {
    var externalAssetInfo = self.externalAssetInfo!.load();
    if (externalAssetInfo is JettonInfo) {
        assert (senderAddress == externalAssetInfo.masterAddress!) throw ERR_INVALID_JETTON_MASTER; 
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

