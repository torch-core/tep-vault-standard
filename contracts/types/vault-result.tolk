type VaultResult = uint16;

@pure
fun VaultResult.Success() {
    return 0 as VaultResult;
}

@pure
fun VaultResult.Failure(errorCode: VaultResult) {
    return errorCode;
}
