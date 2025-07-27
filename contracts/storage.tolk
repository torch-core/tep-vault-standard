
struct Storage {
    totalSupply: coins
    totalAssets: coins
    jettonWalletCode: cell
    walletToMaster: dict  // jetton wallet -> jetton master
    masterToWallet: dict  // jetton master -> jetton wallet
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
