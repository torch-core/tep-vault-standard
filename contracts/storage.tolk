import "constants/common-types"
import "types/wallet-status"

// ==== Vault Storage ====
struct JettonInfo {
    masterAddress: address
    walletAddress: address
}

struct ExtraCurrencyInfo {
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

// ==== Jetton Wallet Storage ====
struct WalletStorage {
    status: WalletStatus
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

