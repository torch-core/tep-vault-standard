type Result = uint16;

@pure
fun VaultResult.Success() {
    return 0 as Result;
}

@pure
fun VaultResult.Error(errCode: Result) {
    return errCode;
}
