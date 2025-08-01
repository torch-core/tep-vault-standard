import "constants/errors";

const DEPOSIT_GAS = ton("0.012");
const WITHDRAW_GAS = ton("0.012");
const PROVIDE_QUOTE_FEE = ton("0.01");

@pure
fun previewTonDepositFee() {
    return DEPOSIT_GAS;
}

@pure
fun previewJettonDepositFee() {
    return DEPOSIT_GAS;
}

@pure
fun previewWithdrawFee() {
    return WITHDRAW_GAS;
}

@pure
fun previewProvideQuoteFee() {
    return PROVIDE_QUOTE_FEE;
}


fun processTonDepositGas(valueCoins: coins, depositAmount: coins) {
    val requiredGas = previewTonDepositFee();
    assert (valueCoins >= depositAmount + requiredGas) throw ERR_TON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - depositAmount - requiredGas;
}

fun processJettonDepositGas(valueCoins: coins) {
    val requiredGas = previewJettonDepositFee();
    assert (valueCoins >= requiredGas) throw ERR_JETTON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - requiredGas;
}

fun processWithdrawGas(valueCoins: coins) {
    val requiredGas = previewWithdrawFee();
    assert (valueCoins >= requiredGas) throw ERR_WITHDRAW_GAS_TOO_LOW;
    return valueCoins - requiredGas;
}

fun processProvideQuoteGas(valueCoins: coins) {
    val requiredGas = previewProvideQuoteFee();
    assert (valueCoins >= requiredGas) throw ERR_PROVIDE_QUOTE_GAS_TOO_LOW;
    return valueCoins - requiredGas;
}