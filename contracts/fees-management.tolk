import "constants/errors";

const DEPOSIT_TON_GAS = 10000;
const DEPOSIT_JETTON_GAS = 10000;
const WITHDRAW_GAS = 10000;

fun validateTonDepositGas(msgValue: coins, depositAmount: coins) {
    assert (msgValue >= depositAmount + DEPOSIT_TON_GAS) throw ERR_TON_DEPOSIT_GAS_TOO_LOW;
}

fun validateJettonDepositGas(msgValue: coins) {
    assert (msgValue >= DEPOSIT_JETTON_GAS) throw ERR_JETTON_DEPOSIT_GAS_TOO_LOW;
}

fun validateWithdrawGas(msgValue: coins) {
    assert (msgValue >= WITHDRAW_GAS) throw ERR_WITHDRAW_GAS_TOO_LOW;
}