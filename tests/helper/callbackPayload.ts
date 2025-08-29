import { Address, beginCell, Cell } from '@ton/core';
import { Opcodes } from '../../wrappers/constants/op';
import { OPCODE_SIZE, QUERY_ID_SIZE, RESULT_SIZE } from '../../wrappers/constants/size';
import { SandboxContract } from '@ton/sandbox';
import { Vault } from '../../wrappers/Vault';
import { TreasuryContract } from '@ton/sandbox';
import { JettonOpcodes } from '../../wrappers/mock-jetton/JettonConstants';

export const SUCCESS_RESULT = 0;

export const DEFAULT_SUCCESS_CALLBACK_PAYLOAD = beginCell()
    .storeUint(Opcodes.Vault.Comment, OPCODE_SIZE)
    .storeStringTail('Vault interaction successful')
    .endCell();

export const DEFAULT_FAIL_CALLBACK_PAYLOAD = beginCell()
    .storeUint(Opcodes.Vault.Comment, OPCODE_SIZE)
    .storeStringTail('Vault interaction failed')
    .endCell();

export function buildTransferNotificationPayload(
    queryId: bigint,
    jettonAmount: bigint,
    sender: Address,
    forwardPayload?: Cell,
) {
    return beginCell()
        .storeUint(JettonOpcodes.TransferNotification, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeCoins(jettonAmount)
        .storeAddress(sender)
        .storeMaybeRef(forwardPayload)
        .endCell();
}

export function buildBurnNotificationPayload(
    queryId: bigint,
    burnAmount: bigint,
    burner: Address,
    responseAddress: Address,
    customPayload?: Cell,
) {
    return beginCell()
        .storeUint(JettonOpcodes.BurnNotification, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeCoins(burnAmount)
        .storeAddress(burner)
        .storeAddress(responseAddress)
        .storeMaybeRef(customPayload)
        .endCell();
}

export function buildVaultNotification(
    queryId: bigint,
    result: number,
    initiator: Address,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    return beginCell()
        .storeUint(Opcodes.Vault.VaultNotification, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeUint(result, RESULT_SIZE)
        .storeAddress(initiator)
        .storeMaybeRef(callbackPayload)
        .storeMaybeRef(inBody)
        .endCell();
}

export function buildVaultNotificationEc(
    queryId: bigint,
    result: number,
    initiator: Address,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    return beginCell()
        .storeUint(Opcodes.Vault.VaultNotificationEc, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeUint(result, RESULT_SIZE)
        .storeAddress(initiator)
        .storeMaybeRef(callbackPayload)
        .storeMaybeRef(inBody)
        .endCell();
}

export function buildCallbackFp(
    queryId: bigint,
    transferAmount: bigint,
    vault: SandboxContract<Vault>,
    result: number,
    initiator: SandboxContract<TreasuryContract>,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    const fowardPayload = beginCell()
        .storeUint(Opcodes.Vault.VaultNotificationFp, OPCODE_SIZE)
        .storeUint(result, RESULT_SIZE)
        .storeAddress(initiator.address)
        .storeMaybeRef(callbackPayload ?? DEFAULT_SUCCESS_CALLBACK_PAYLOAD)
        .storeMaybeRef(inBody)
        .endCell();
    return buildTransferNotificationPayload(queryId, transferAmount, vault.address, fowardPayload);
}
