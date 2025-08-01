import "constants/errors";

const DEPOSIT_GAS = ton("0.012");
const WITHDRAW_GAS = ton("0.012");

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

