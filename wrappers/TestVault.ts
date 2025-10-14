import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type TestVaultConfig = {
    id: number;
    counter: number;
};

export function testVaultConfigToCell(config: TestVaultConfig): Cell {
    return beginCell().storeUint(config.id, 32).storeUint(config.counter, 32).endCell();
}

export const Opcodes = {
    OP_INCREASE: 0x7e8764ef,
    OP_INVALID_TRANSFER_AMOUNT: 0xa2519c55,
    OP_MISSING_JETTON_WALLET: 0xcf97c20f,
    OP_WRONG_ROUNDING_TYPE: 0x10ba9058,
};

export class TestVault implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new TestVault(address);
    }

    static createFromConfig(config: TestVaultConfig, code: Cell, workchain = 0) {
        const data = testVaultConfigToCell(config);
        const init = { code, data };
        return new TestVault(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendInvalidTransferAmount(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.OP_INVALID_TRANSFER_AMOUNT, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }

    async sendMissingJettonWallet(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.OP_MISSING_JETTON_WALLET, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }

    async sendWrongRoundingType(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.OP_WRONG_ROUNDING_TYPE, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }
}
