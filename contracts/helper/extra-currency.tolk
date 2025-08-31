@pure
fun builder.storeEcValue(mutate self, x: int): self
    asm "STVARUINT32";

@pure
fun slice.loadEcValue(mutate self): int
    asm(-> 1 0) "LDVARUINT32";
