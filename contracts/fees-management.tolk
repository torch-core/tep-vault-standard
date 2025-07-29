import "constants/errors";

const DEPOSIT_TON_GAS = ton("0.012");
const DEPOSIT_JETTON_GAS = 10000;
const WITHDRAW_GAS = 10000;

fun processTonDepositGas(valueCoins: coins, depositAmount: coins) {
    assert (valueCoins >= depositAmount + DEPOSIT_TON_GAS) throw ERR_TON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - depositAmount - DEPOSIT_TON_GAS;
}

fun processJettonDepositGas(valueCoins: coins) {
    assert (valueCoins >= DEPOSIT_JETTON_GAS) throw ERR_JETTON_DEPOSIT_GAS_TOO_LOW;
    return valueCoins - DEPOSIT_JETTON_GAS;
}

fun processWithdrawGas(valueCoins: coins) {
    assert (valueCoins >= WITHDRAW_GAS) throw ERR_WITHDRAW_GAS_TOO_LOW;
    return valueCoins - WITHDRAW_GAS;
}