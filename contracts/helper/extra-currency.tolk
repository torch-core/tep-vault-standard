@pure
fun builder.storeVarUInt32(mutate self, x: int): self
    asm "STVARUINT32";

@pure
fun slice.loadVarUInt32(mutate self): int
    asm(-> 1 0) "LDVARUINT32";
