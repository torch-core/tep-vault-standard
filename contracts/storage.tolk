struct AssetJettonInfo {
    masterAddress: address?
    walletAddress: address?
}

struct Storage {
    adminAddress: address
    assetJettonInfo: Cell<AssetJettonInfo>?
    totalSupply: coins
    totalAssets: coins
    jettonWalletCode: cell
    content: cell
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
