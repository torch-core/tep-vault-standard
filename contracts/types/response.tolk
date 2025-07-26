type VaultStatus = uint16;

fun VaultStatus.Success() {
    return 0 as VaultStatus;
}

fun VaultStatus.Failure(errorCode: VaultStatus) {
    return errorCode;
}
