type Result = uint16;

@pure
fun Result.Success() {
    return 0 as Result;
}

@pure
fun Result.Error(errCode: Result) {
    return errCode;
}
