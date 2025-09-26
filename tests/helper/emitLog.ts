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
    oldTotalAssetAmount: bigint,
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
    const vaultStateAfter = extBody.loadRef();
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(oldTotalSupply + shares);
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(oldTotalAssetAmount + depositAmount);
    expect(extBody.loadMaybeRef()).toBe(optionalDepositLogs ?? null);
}

export function expectWithdrawnEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    withdrawAmount: bigint,
    burnShares: bigint,
    oldTotalSupply: bigint,
    oldTotalAssetAmount: bigint,
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
    const vaultStateAfter = extBody.loadRef();
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(oldTotalSupply - burnShares);
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(oldTotalAssetAmount - withdrawAmount);
    expect(extBody.loadMaybeRef()).toBe(optionalWithdrawLogs ?? null);
}

export function expectQuotedEmitLog(
    result: SendMessageResult,
    initiator: Address,
    receiver: Address,
    quoteAsset: Asset,
    totalSupply: bigint,
    totalAssetAmount: bigint,
    optionalQuotedLogs?: Cell,
) {
    expect(result.externals[0].info.dest?.value).toBe(BigInt(Topics.Quoted));
    const extBody = result.externals[0].body.beginParse();

    expect(extBody.loadUint(OPCODE_SIZE)).toBe(Topics.Quoted);
    expect(extBody.loadRef().equals(quoteAsset.toCell())).toBeTruthy();
    expect(extBody.loadAddress().equals(initiator)).toBeTruthy();
    expect(extBody.loadMaybeAddress()?.equals(receiver)).toBeTruthy();
    const vaultStateAfter = extBody.loadRef();
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(totalSupply);
    expect(vaultStateAfter.beginParse().loadCoins()).toBe(totalAssetAmount);
    expect(extBody.loadMaybeRef()).toBe(optionalQuotedLogs ?? null);
}