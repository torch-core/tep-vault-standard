import { Address, beginCell, Cell } from '@ton/core';
import { Opcodes } from '../../wrappers/constants/op';
import { OPCODE_SIZE, QUERY_ID_SIZE, RESULT_SIZE } from '../../wrappers/constants/size';
import { SandboxContract } from '@ton/sandbox';
import { Vault } from '../../wrappers/Vault';
import { TreasuryContract } from '@ton/sandbox';
import { JettonOpcodes } from '../../wrappers/mock-jetton/JettonConstants';

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

export function buildFailVaultNotification(
    queryId: bigint,
    errorCode: number,
    initiator: Address,
    callbackPayload?: Cell,
    inBody?: Cell,
) {
    return beginCell()
        .storeUint(Opcodes.Vault.VaultNotification, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeUint(errorCode, RESULT_SIZE)
        .storeAddress(initiator)
        .storeRef(callbackPayload ?? DEFAULT_FAIL_CALLBACK_PAYLOAD)
        .storeMaybeRef(inBody)
        .endCell();
}

export function buildSuccessCallbackFp(
    queryId: bigint,
    depositAmount: bigint,
    vault: SandboxContract<Vault>,
    initiator: SandboxContract<TreasuryContract>,
    successCallbackPayload?: Cell,
    inBody?: Cell,
) {
    const callbackPayload = beginCell()
        .storeUint(Opcodes.Vault.VaultNotificationFp, OPCODE_SIZE)
        .storeUint(0, RESULT_SIZE)
        .storeAddress(initiator.address)
        .storeRef(successCallbackPayload ?? DEFAULT_SUCCESS_CALLBACK_PAYLOAD)
        .storeMaybeRef(inBody)
        .endCell();
    return buildTransferNotificationPayload(queryId, depositAmount, vault.address, callbackPayload);
}
