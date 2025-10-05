import "../constants/common-types"
import "../constants/errors"

fun extractSingleEcAmount(extraCurrencyMap: ExtraCurrenciesMap, extraCurrencyId: ExtraCurrencyId) {
    var value = extraCurrencyMap.deleteAndGetDeleted(extraCurrencyId);

    // Verifies Extra Currency id is valid
    assert(value.isFound) throw ERR_INVALID_EXTRA_CURRENCY_ID;

    // Verifies only one Extra Currency is deposited to prevent multiple Extra Currency deposits in a single asset vault
    assert(extraCurrencyMap.isEmpty()) throw ERR_MULTI_EXTRA_CURRENCY_DEPOSIT;

    return value.loadValue() as coins;
}
