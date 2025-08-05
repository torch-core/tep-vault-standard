import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';
import { OPCODE_SIZE, QUERY_ID_SIZE } from './constants/size';
import { Opcodes } from './constants/op';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { JettonMaster } from '@ton/ton';

export type VaultConfig = {
    adminAddress: Address;
    totalSupply: bigint;
    totalAssets: bigint;
    masterAddress?: Address;
    jettonWalletCode: Cell;
    content: Cell;
};

export function vaultConfigToCell(config: VaultConfig): Cell {
    const assetJettonInfo = config.masterAddress
        ? beginCell().storeAddress(config.masterAddress).storeAddress(null).endCell()
        : null;
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeCoins(config.totalSupply)
        .storeCoins(config.totalAssets)
        .storeMaybeRef(assetJettonInfo)
        .storeRef(config.jettonWalletCode)
        .storeRef(config.content)
        .endCell();
}

export interface VaultStorage {
    adminAddress: Address;
    totalSupply: bigint;
    totalAssets: bigint;
    jettonMaster: Address | null;
    jettonWalletAddress: Address | null;
    jettonWalletCode: Cell;
    content: Cell;
}

export interface OptionalParams {}

export interface CallbackParams {
    includeBody: boolean;
    payload: Cell;
}

export interface Callbacks {
    successCallback?: CallbackParams;
    failureCallback?: CallbackParams;
}

export interface DepositParams {
    receiver?: Address;
    minShares?: bigint;
    optionalParams?: OptionalParams;
    callbacks?: Callbacks;
}

export interface Deposit {
    queryId: bigint;
    depositAmount: bigint;
    depositParams?: DepositParams;
}

export interface WithdrawParams {
    receiver?: Address;
    minWithdraw?: bigint;
    optionalParams?: OptionalParams;
    callbacks?: Callbacks;
}

export interface JettonTransferParams {
    queryId: bigint;
    amount: bigint;
    recipient: Address;
    responseDst: Address;
    customPayload?: Maybe<Cell>;
    forwardAmount?: bigint;
    forwardPayload?: Maybe<Cell>;
}

export interface JettonBurnParams {
    queryId: bigint;
    amount: bigint;
    responseDst?: Address;
    customPayload?: Maybe<Cell>;
}

export class Vault implements Contract {
    constructor(
        readonly address: Address,
        readonly jettonMaster?: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address, jettonMaster?: Address) {
        return new Vault(address, jettonMaster);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), config.masterAddress, init);
    }

    private optionalVaultParamsToCell(params?: OptionalParams): Cell | null {
        return null;
    }

    private callbackParamsToCell(params: CallbackParams): Cell {
        return beginCell().storeBit(params.includeBody).storeRef(params.payload).endCell();
    }

    storeVaultDepositParams(params?: DepositParams) {
        return (builder: Builder) => {
            return builder
                .storeAddress(params?.receiver)
                .storeCoins(params?.minShares ?? 0n)
                .storeMaybeRef(this.optionalVaultParamsToCell(params?.optionalParams))
                .storeMaybeRef(
                    params?.callbacks?.successCallback
                        ? this.callbackParamsToCell(params.callbacks.successCallback)
                        : null,
                )
                .storeMaybeRef(
                    params?.callbacks?.failureCallback
                        ? this.callbackParamsToCell(params.callbacks.failureCallback)
                        : null,
                )
                .endCell();
        };
    }

    storeVaultWithdrawFp(burner: Address, withdrawParams?: WithdrawParams) {
        return (builder: Builder) => {
            return builder
                .storeUint(Opcodes.Vault.WithdrawFp, OPCODE_SIZE)
                .storeAddress(withdrawParams?.receiver ?? burner)
                .storeCoins(withdrawParams?.minWithdraw ?? 0n)
                .storeMaybeRef(this.optionalVaultParamsToCell(withdrawParams?.optionalParams))
                .storeMaybeRef(
                    withdrawParams?.callbacks?.successCallback
                        ? this.callbackParamsToCell(withdrawParams?.callbacks.successCallback)
                        : null,
                )
                .storeMaybeRef(
                    withdrawParams?.callbacks?.failureCallback
                        ? this.callbackParamsToCell(withdrawParams?.callbacks.failureCallback)
                        : null,
                )
                .endCell();
        };
    }

    storeJettonTransferMessage(params: JettonTransferParams): (builder: Builder) => void {
        return (builder: Builder) => {
            return builder
                .storeUint(Opcodes.Jetton.Transfer, OPCODE_SIZE)
                .storeUint(params.queryId, QUERY_ID_SIZE)
                .storeCoins(params.amount)
                .storeAddress(params.recipient)
                .storeAddress(params.responseDst)
                .storeMaybeRef(params.customPayload ?? null)
                .storeCoins(params.forwardAmount ?? 0)
                .storeMaybeRef(params.forwardPayload ?? null)
                .endCell();
        };
    }

    storeJettonBurnMessage(params: JettonBurnParams): (builder: Builder) => void {
        return (builder: Builder) => {
            return builder
                .storeUint(Opcodes.Jetton.Burn, OPCODE_SIZE)
                .storeUint(params.queryId, QUERY_ID_SIZE)
                .storeCoins(params.amount)
                .storeAddress(params.responseDst)
                .storeMaybeRef(params.customPayload ?? null)
                .endCell();
        };
    }

    static createDeployVaultArg(queryId?: bigint) {
        return {
            value: toNano('0.08'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.Vault.DeployVault, OPCODE_SIZE)
                .storeUint(queryId ?? 8n, QUERY_ID_SIZE)
                .endCell(),
        };
    }

    async sendDeploy(provider: ContractProvider, via: Sender, queryId?: bigint) {
        await provider.internal(via, Vault.createDeployVaultArg(queryId));
    }

    async getTonDepositArg(provider: ContractProvider, deposit: Deposit) {
        return {
            to: this.address,
            value: toNano('0.1') + deposit.depositAmount,
            body: beginCell()
                .storeUint(Opcodes.Vault.Deposit, OPCODE_SIZE)
                .storeUint(deposit.queryId, QUERY_ID_SIZE)
                .storeCoins(deposit.depositAmount)
                .store(this.storeVaultDepositParams(deposit.depositParams))
                .endCell(),
        };
    }

    async getJettonDepositArg(
        provider: ContractProvider,
        depositor: Address,
        deposit: Deposit,
        forwardAmount: bigint = toNano('0.1'),
    ) {
        if (!this.jettonMaster) {
            throw new Error('Jetton Master is not set');
        }
        const jettonMaster = provider.open(JettonMaster.create(this.jettonMaster));
        const jettonWalletAddress = await jettonMaster.getWalletAddress(depositor);
        return {
            to: jettonWalletAddress,
            value: toNano('0.07') + forwardAmount,
            body: beginCell()
                .store(
                    this.storeJettonTransferMessage({
                        queryId: deposit.queryId,
                        amount: deposit.depositAmount,
                        recipient: this.address,
                        responseDst: depositor,
                        forwardAmount,
                        forwardPayload: beginCell()
                            .storeUint(Opcodes.Vault.DepositFp, OPCODE_SIZE)
                            .store(this.storeVaultDepositParams(deposit.depositParams))
                            .endCell(),
                    }),
                )
                .endCell(),
        };
    }

    async getWithdrawArg(
        provider: ContractProvider,
        burner: Address,
        shares: bigint,
        withdrawParams?: WithdrawParams,
        queryId?: bigint,
    ) {
        const jettonMaster = provider.open(JettonMaster.create(this.address));
        const jettonWalletAddress = await jettonMaster.getWalletAddress(burner);
        return {
            to: jettonWalletAddress,
            value: toNano('0.3'),
            body: beginCell()
                .store(
                    this.storeJettonBurnMessage({
                        queryId: queryId ?? 8n,
                        amount: shares,
                        responseDst: burner,
                        customPayload: beginCell().store(this.storeVaultWithdrawFp(burner, withdrawParams)).endCell(),
                    }),
                )
                .endCell(),
        };
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(owner).endCell(),
            },
        ]);
        return res.stack.readAddress();
    }

    async getPreviewWithdraw(provider: ContractProvider, shares: bigint, optionalParams?: OptionalParams) {
        const res = await provider.get('getPreviewWithdraw', [
            {
                type: 'int',
                value: shares,
            },
            optionalParams
                ? {
                      type: 'cell',
                      cell: this.optionalVaultParamsToCell(optionalParams)!,
                  }
                : { type: 'null' },
        ]);

        return res.stack.readBigNumber();
    }

    async getStorage(provider: ContractProvider) {
        const { state } = await provider.getState();
        if (state.type !== 'active' || !state.code || !state.data) {
            throw new Error('Vault Contract is not active');
        }
        const storageBoc = Cell.fromBoc(state.data)[0];
        if (!storageBoc) {
            throw new Error('Vault Contract is not initialized');
        }
        const storageSlice = storageBoc.beginParse();
        const adminAddress = storageSlice.loadAddress();
        const totalSupply = storageSlice.loadCoins();
        const totalAssets = storageSlice.loadCoins();
        const assetJettonInfoCell = storageSlice.loadMaybeRef();
        let jettonMaster: Address | null = null;
        let jettonWalletAddress: Address | null = null;
        if (assetJettonInfoCell) {
            const assetJettonInfoSlice = assetJettonInfoCell.beginParse();
            jettonMaster = assetJettonInfoSlice.loadAddress();
            jettonWalletAddress = assetJettonInfoSlice.loadMaybeAddress();
        }
        const jettonWalletCode = storageSlice.loadRef();
        const content = storageSlice.loadRef();
        return { adminAddress, totalSupply, totalAssets, jettonMaster, jettonWalletAddress, jettonWalletCode, content };
    }
}
