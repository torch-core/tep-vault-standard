import "constants/errors";

const DEPOSIT_GAS = ton("0.012");
const WITHDRAW_GAS = ton("0.012");

fun processTonDepositGas(valueCoins: coins, depositAmount: coins) {
    assert (valueCoins >= depositAmount + DEPOSIT_GAS) throw ERR_TON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - depositAmount - DEPOSIT_GAS;
}

fun processJettonDepositGas(valueCoins: coins) {
    assert (valueCoins >= DEPOSIT_GAS) throw ERR_JETTON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - DEPOSIT_GAS;
}

fun processWithdrawGas(valueCoins: coins) {
    assert (valueCoins >= WITHDRAW_GAS) throw ERR_WITHDRAW_GAS_TOO_LOW;
    return valueCoins - WITHDRAW_GAS;
}