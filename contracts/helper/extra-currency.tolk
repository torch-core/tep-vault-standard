@pure
fun builder.storeVarUint32(mutate self, x: int): self
    asm "STVARUINT32";

@pure
fun slice.loadVarUint32(mutate self): int
    asm(-> 1 0) "LDVARUINT32";
