type VaultResult = uint16;

@pure
fun VaultResult.Success() {
    return 0 as VaultResult;
}

@pure
fun VaultResult.Error(errCode: VaultResult) {
    return errCode;
}
