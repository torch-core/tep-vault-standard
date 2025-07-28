struct AssetJettonInfo {
    masterAddress: address?
    walletAddress: address?
}

struct Storage {
    adminAddress: address
    totalSupply: coins
    totalAssets: coins
    assetJettonInfo: Cell<AssetJettonInfo>?
    jettonWalletCode: cell
    content: cell
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
