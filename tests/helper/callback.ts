import { Address, beginCell, Cell } from '@ton/core';
import { VaultOpcodes } from '../../wrappers/constants/op';
import { OPCODE_SIZE, QUERY_ID_SIZE, RESULT_SIZE } from '../../wrappers/constants/size';
import { SandboxContract } from '@ton/sandbox';
import { Vault } from '../../wrappers/Vault';
import { TreasuryContract } from '@ton/sandbox';
import { JettonOpcodes } from '../../wrappers/jetton/JettonConstants';

export const DEFAULT_SUCCESS_CALLBACK_PAYLOAD = beginCell()
    .storeUint(VaultOpcodes.Comment, OPCODE_SIZE)
    .storeStringTail('Vault interaction successful')
    .endCell();

export function buildJettonTransferNotificationPayload(
    queryId: bigint,
    jettonAmount: bigint,
    receiver: Address,
    forwardPayload?: Cell,
) {
    return beginCell()
        .storeUint(JettonOpcodes.TransferNotification, OPCODE_SIZE)
        .storeUint(queryId, QUERY_ID_SIZE)
        .storeCoins(jettonAmount)
        .storeAddress(receiver)
        .storeMaybeRef(forwardPayload)
        .endCell();
}

export function buildSuccessCallbackPayload(
    queryId: bigint,
    depositAmount: bigint,
    vault: SandboxContract<Vault>,
    initiator: SandboxContract<TreasuryContract>,
    successCallbackPayload?: Cell,
    inBody?: Cell,
) {
    const callbackPayload = beginCell()
        .storeUint(VaultOpcodes.VaultNotificationFp, OPCODE_SIZE)
        .storeUint(0, RESULT_SIZE)
        .storeAddress(initiator.address)
        .storeRef(successCallbackPayload ?? DEFAULT_SUCCESS_CALLBACK_PAYLOAD)
        .storeMaybeRef(inBody)
        .endCell();
    return buildJettonTransferNotificationPayload(queryId, depositAmount, vault.address, callbackPayload);
}
