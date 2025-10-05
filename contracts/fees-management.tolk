import "constants/errors";

// Transaction Fees
const JETTON_TRANSFER_FEE = ton("0.06");
const REQUEST_JETTON_WALLET_ADDRESS_FEE = ton("0.05");

// Gas Fees
const DEPOSIT_GAS = ton("0.013");
const WITHDRAW_GAS = ton("0.012");
const PROVIDE_QUOTE_GAS = ton("0.01");

@pure
fun previewTonDepositFee() {
    return DEPOSIT_GAS;
}

@pure
fun previewJettonDepositFee() {
    return DEPOSIT_GAS;
}

@pure
fun previewExtraCurrencyDepositFee() {
    return DEPOSIT_GAS;
}

@pure
fun previewWithdrawFee() {
    return WITHDRAW_GAS;
}

@pure
fun previewProvideQuoteFee() {
    return PROVIDE_QUOTE_GAS;
}

fun chargeTonDepositGas(valueCoins: coins, depositAmount: coins) {
    val requiredGas = previewTonDepositFee();
    // JETTON_TRANSFER_FEE is for minting shares to receiver
    assert (valueCoins >= depositAmount + requiredGas + JETTON_TRANSFER_FEE) throw ERR_INSUFFICIENT_TON_DEPOSIT_GAS;
    return valueCoins - depositAmount - requiredGas;
}

fun chargeJettonDepositGas(valueCoins: coins) {
    val requiredGas = previewJettonDepositFee();
    assert (valueCoins >= requiredGas + JETTON_TRANSFER_FEE) throw ERR_INSUFFICIENT_JETTON_DEPOSIT_GAS;
    return valueCoins - requiredGas;
}

fun chargeExtraCurrencyDepositGas(valueCoins: coins) {
    val requiredGas = previewExtraCurrencyDepositFee();
    assert (valueCoins >= requiredGas + JETTON_TRANSFER_FEE) throw ERR_INSUFFICIENT_EXTRA_CURRENCY_DEPOSIT_GAS;
    return valueCoins - requiredGas;
}

fun chargeWithdrawGas(valueCoins: coins) {
    val requiredGas = previewWithdrawFee();
    // Overestimate withdrawal gas using Jetton transfer fee (most expensive case among TON/Jetton/Extra Currency transfers)
    assert (valueCoins >= requiredGas + JETTON_TRANSFER_FEE) throw ERR_INSUFFICIENT_WITHDRAW_GAS;
    return valueCoins - requiredGas;
}

fun chargeProvideQuoteGas(valueCoins: coins) {
    val requiredGas = previewProvideQuoteFee();
    assert (valueCoins >= requiredGas) throw ERR_INSUFFICIENT_PROVIDE_QUOTE_GAS;
    return valueCoins - requiredGas;
}