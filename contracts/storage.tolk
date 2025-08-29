import "constants/common-types"
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

// ==== Jetton Wallet Storage ====
struct WalletStorage {
    status: WalletStatus
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

