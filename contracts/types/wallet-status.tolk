type WalletStatus = uint4;

@pure
fun WalletStatus.unlocked() {
    return 0 as WalletStatus;
}

@pure
fun WalletStatus.sendLocked() {
    return 1 as WalletStatus;
}

@pure
fun WalletStatus.receiveLocked() {
    return 2 as WalletStatus;
}