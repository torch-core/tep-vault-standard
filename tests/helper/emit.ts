import { SendMessageResult } from '@ton/sandbox';
import { Topics } from '../../wrappers/constants/topic';
import { OPCODE_SIZE } from '../../wrappers/constants/size';
import { Address, Cell } from '@ton/core';

export function expectDepositedEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    depositAmount: bigint,
    shares: bigint,
    depositAsset?: Cell,
) {
    expect(result.externals[0].info.dest?.value).toBe(BigInt(Topics.Deposited));
    const extBody = result.externals[0].body.beginParse();

    expect(extBody.loadUint(OPCODE_SIZE)).toBe(Topics.Deposited);
    expect(extBody.loadAddress().equals(initiator)).toBeTruthy();
    expect(extBody.loadMaybeAddress()?.equals(receiver)).toBeTruthy();
    expect(extBody.loadMaybeRef()).toBe(depositAsset ?? null);
    expect(extBody.loadCoins()).toBe(depositAmount);
    expect(extBody.loadCoins()).toBe(shares);
}
