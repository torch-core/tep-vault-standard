type VaultResult = uint16;

fun VaultResult.Success() {
    return 0 as VaultResult;
}

fun VaultResult.Failure(errorCode: VaultResult) {
    return errorCode;
}
