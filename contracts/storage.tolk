import "role-authority/auth";

struct Storage {
    totalSupply: coins
    totalAssets: coins
    auth: Cell<Auth> // Add Auth struct to contract's storage
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}
