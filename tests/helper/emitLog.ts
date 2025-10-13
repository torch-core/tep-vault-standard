import { SendMessageResult } from '@ton/sandbox';
import { Topics } from '../../wrappers/constants/topic';
import { OPCODE_SIZE } from '../../wrappers/constants/size';
import { Address, Cell } from '@ton/core';
import { Asset } from '@torch-finance/core';

export function expectDepositedEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    depositAmount: bigint,
    shares: bigint,
    oldTotalSupply: bigint,
    oldTotalAssets: bigint,
    depositAsset: Asset,
    optionalDepositLogs?: Cell,
) {
    expect(result.externals[0].info.dest?.value).toBe(BigInt(Topics.Deposited));
    const extBody = result.externals[0].body.beginParse();

    expect(extBody.loadUint(OPCODE_SIZE)).toBe(Topics.Deposited);
    expect(extBody.loadAddress().equals(initiator)).toBeTruthy();
    expect(extBody.loadMaybeAddress()?.equals(receiver)).toBeTruthy();
    expect(extBody.loadRef().equals(depositAsset.toCell())).toBeTruthy();
    expect(extBody.loadCoins()).toBe(depositAmount);
    expect(extBody.loadCoins()).toBe(shares);
    const vaultState = extBody.loadRef();
    expect(vaultState.beginParse().loadCoins()).toBe(oldTotalSupply + shares);
    expect(vaultState.beginParse().loadCoins()).toBe(oldTotalAssets + depositAmount);
    expect(extBody.loadMaybeRef()).toBe(optionalDepositLogs ?? null);
}

export function expectWithdrawnEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    withdrawAmount: bigint,
    burnShares: bigint,
    oldTotalSupply: bigint,
    oldTotalAssets: bigint,
    withdrawAsset: Asset,
    optionalWithdrawLogs?: Cell,
) {
    expect(result.externals[0].info.dest?.value).toBe(BigInt(Topics.Withdrawn));
    const extBody = result.externals[0].body.beginParse();

    expect(extBody.loadUint(OPCODE_SIZE)).toBe(Topics.Withdrawn);
    expect(extBody.loadAddress().equals(initiator)).toBeTruthy();
    expect(extBody.loadMaybeAddress()?.equals(receiver)).toBeTruthy();
    expect(extBody.loadRef().equals(withdrawAsset.toCell())).toBeTruthy();
    expect(extBody.loadCoins()).toBe(withdrawAmount);
    expect(extBody.loadCoins()).toBe(burnShares);
    const vaultState = extBody.loadRef();
    expect(vaultState.beginParse().loadCoins()).toBe(oldTotalSupply - burnShares);
    expect(vaultState.beginParse().loadCoins()).toBe(oldTotalAssets - withdrawAmount);
    expect(extBody.loadMaybeRef()).toBe(optionalWithdrawLogs ?? null);
}

export function expectQuotedEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    quoteAsset: Asset,
    totalSupply: bigint,
    totalAssets: bigint,
    optionalQuotedLogs?: Cell,
) {
    expect(result.externals[0].info.dest?.value).toBe(BigInt(Topics.Quoted));
    const extBody = result.externals[0].body.beginParse();

    expect(extBody.loadUint(OPCODE_SIZE)).toBe(Topics.Quoted);
    expect(extBody.loadRef().equals(quoteAsset.toCell())).toBeTruthy();
    expect(extBody.loadAddress().equals(initiator)).toBeTruthy();
    expect(extBody.loadMaybeAddress()?.equals(receiver)).toBeTruthy();
    const vaultState = extBody.loadRef();
    expect(vaultState.beginParse().loadCoins()).toBe(totalSupply);
    expect(vaultState.beginParse().loadCoins()).toBe(totalAssets);
    expect(extBody.loadMaybeRef()).toBe(optionalQuotedLogs ?? null);
}
