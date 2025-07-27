struct Storage {
    totalSupply: coins
    totalAssets: coins
    jettonWalletCode: cell
    assetJettonMaster: address
    assetJettonWallet: address
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
