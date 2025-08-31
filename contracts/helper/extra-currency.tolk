import "@stdlib/tvm-dicts"
import "../constants/common-types"
import "../constants/errors"
import "../constants/values"

@pure
fun builder.storeEcValue(mutate self, x: int): self
    asm "STVARUINT32";

@pure
fun slice.loadEcValue(mutate self): int
    asm(-> 1 0) "LDVARUINT32";

fun extractSingleEcAmount(extraCurrencyDict: dict, extraCurrencyId: ExtraCurrencyId) {
    var (value, flag) = extraCurrencyDict.uDictDeleteAndGet(EXTRA_CURRENCY_ID_SIZE, extraCurrencyId);

    // Verifies Extra Currency id is valid
    assert(flag) throw ERR_INVALID_EXTRA_CURRENCY_ID;

    // Verifies only one Extra Currency is deposited to prevent multiple Extra Currency deposits in a single asset vault
    assert(extraCurrencyDict == null) throw ERR_MULTI_EXTRA_CURRENCY_DEPOSIT;

    return value!.loadEcValue();
}