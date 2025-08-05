import "constants/errors";

// Transaction Fees
const JETTON_TRANSFER_FEE = ton("0.06");
const REQUEST_JETTON_WALLET_ADDRESS_FEE = ton("0.05");
const DEFAULT_JETTON_NOTIFICATION_FEE = 1;

// Gas Fees
const DEPOSIT_GAS = ton("0.012");
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
fun previewWithdrawFee() {
    return WITHDRAW_GAS;
}

@pure
fun previewProvideQuoteFee() {
    return PROVIDE_QUOTE_GAS;
}

fun processTonDepositGas(valueCoins: coins, depositAmount: coins) {
    val requiredGas = previewTonDepositFee();
    assert (valueCoins >= depositAmount + requiredGas) throw ERR_INSUFFICIENT_TON_DEPOSIT_GAS;
    return valueCoins - depositAmount - requiredGas;
}

fun processJettonDepositGas(valueCoins: coins) {
    val requiredGas = previewJettonDepositFee();
    assert (valueCoins >= requiredGas) throw ERR_INSUFFICIENT_JETTON_DEPOSIT_GAS;
    return valueCoins - requiredGas;
}

fun processWithdrawGas(valueCoins: coins) {
    val requiredGas = previewWithdrawFee();
    assert (valueCoins >= requiredGas) throw ERR_INSUFFICIENT_WITHDRAW_GAS;
    return valueCoins - requiredGas;
}

fun processProvideQuoteGas(valueCoins: coins) {
    val requiredGas = previewProvideQuoteFee();
    assert (valueCoins >= requiredGas) throw ERR_INSUFFICIENT_PROVIDE_QUOTE_GAS;
    return valueCoins - requiredGas;
}