import "types/WalletStatus"


// ==== Vault Storage ====
struct AssetJettonInfo {
    masterAddress: address
    walletAddress: address
}

struct VaultStorage {
    adminAddress: address
    totalSupply: coins
    totalAssets: coins
    assetJettonInfo: Cell<AssetJettonInfo>?
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

