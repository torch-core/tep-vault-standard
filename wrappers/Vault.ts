import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SenderArguments,
    SendMode,
    toNano,
} from '@ton/core';
import { ASSET_TYPE_SIZE, EXTRA_CURRENCY_ID_SIZE, OPCODE_SIZE, QUERY_ID_SIZE } from './constants/size';
import { Opcodes } from './constants/op';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { JettonMaster } from '@ton/ton';
import { AssetType, parseAssetsFromNestedCell } from '@torch-finance/core';

export type VaultConfig = {
    adminAddress: Address;
    totalSupply: bigint;
    totalAssets: bigint;
    masterAddress?: Address;
    extraCurrencyId?: number;
    jettonWalletCode: Cell;
    content: Cell;
};

export function vaultConfigToCell(config: VaultConfig): Cell {
    let externalAssetInfo: Cell | null = null;
    if (config.masterAddress) {
        externalAssetInfo = beginCell()
            .storeUint(AssetType.JETTON, ASSET_TYPE_SIZE)
            .storeAddress(config.masterAddress)
            .storeAddress(null)
            .endCell();
    } else if (config.extraCurrencyId !== undefined) {
        externalAssetInfo = beginCell()
            .storeUint(AssetType.EXTRA_CURRENCY, ASSET_TYPE_SIZE)
            .storeUint(config.extraCurrencyId, EXTRA_CURRENCY_ID_SIZE)
            .endCell();
    }
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeCoins(config.totalSupply)
        .storeCoins(config.totalAssets)
        .storeMaybeRef(externalAssetInfo)
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
    extraCurrencyId: number | null;
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
        readonly extraCurrencyId?: number,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address, jettonMaster?: Address, extraCurrencyId?: number) {
        return new Vault(address, jettonMaster, extraCurrencyId);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), config.masterAddress, config.extraCurrencyId, init);
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

    async getEcDepositArg(provider: ContractProvider, deposit: Deposit): Promise<SenderArguments> {
        if (this.extraCurrencyId === undefined) {
            throw new Error('Extra currency id is not set');
        }
        return {
            to: this.address,
            value: toNano('0.1'),
            body: beginCell()
                .storeUint(Opcodes.Vault.DepositEc, OPCODE_SIZE)
                .storeUint(deposit.queryId, QUERY_ID_SIZE)
                .store(this.storeVaultDepositParams(deposit.depositParams))
                .endCell(),
            extracurrency: {
                [this.extraCurrencyId]: deposit.depositAmount,
            },
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

    async getPreviewTonDepositFee(provider: ContractProvider) {
        const res = await provider.get('getPreviewTonDepositFee', []);
        return res.stack.readBigNumber();
    }

    async getPreviewJettonDepositFee(provider: ContractProvider) {
        const res = await provider.get('getPreviewJettonDepositFee', []);
        return res.stack.readBigNumber();
    }

    async getMaxDeposit(provider: ContractProvider) {
        const res = await provider.get('getMaxDeposit', [
            {
                type: 'null',
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getMaxWithdraw(provider: ContractProvider) {
        const res = await provider.get('getMaxWithdraw', [
            {
                type: 'null',
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getPreviewWithdrawFee(provider: ContractProvider) {
        const res = await provider.get('getPreviewWithdrawFee', []);
        return res.stack.readBigNumber();
    }

    async getPreviewProvideQuoteFee(provider: ContractProvider) {
        const res = await provider.get('getPreviewProvideQuoteFee', []);
        return res.stack.readBigNumber();
    }

    async getAssets(provider: ContractProvider) {
        const res = await provider.get('getAssets', []);
        const assetsCell = res.stack.readCell();
        return parseAssetsFromNestedCell(assetsCell);
    }

    async getTotalAssets(provider: ContractProvider) {
        const res = await provider.get('getTotalAssets', [
            {
                type: 'null',
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getConvertToShares(provider: ContractProvider, depositAmount: bigint) {
        const res = await provider.get('getConvertToShares', [
            {
                type: 'int',
                value: depositAmount,
            },
            {
                type: 'null',
            },
            {
                type: 'int',
                value: 0n, // Rounding type: ROUND_DOWN
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getConvertToAssets(provider: ContractProvider, shares: bigint) {
        const res = await provider.get('getConvertToAssets', [
            {
                type: 'int',
                value: shares,
            },
            {
                type: 'null',
            },
            {
                type: 'int',
                value: 0n, // Rounding type: ROUND_DOWN
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode,
        };
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
        const externalAssetInfo = storageSlice.loadMaybeRef();
        let jettonMaster: Address | null = null;
        let jettonWalletAddress: Address | null = null;
        let extraCurrencyId: number | null = null;
        if (externalAssetInfo) {
            const externalAssetInfoSlice = externalAssetInfo.beginParse();
            const assetType = externalAssetInfoSlice.loadUint(ASSET_TYPE_SIZE);
            if (assetType === AssetType.JETTON) {
                jettonMaster = externalAssetInfoSlice.loadAddress();
                jettonWalletAddress = externalAssetInfoSlice.loadMaybeAddress();
            } else if (assetType === AssetType.EXTRA_CURRENCY) {
                extraCurrencyId = externalAssetInfoSlice.loadUint(EXTRA_CURRENCY_ID_SIZE);
            }
        }
        const jettonWalletCode = storageSlice.loadRef();
        const content = storageSlice.loadRef();
        return {
            adminAddress,
            totalSupply,
            totalAssets,
            jettonMaster,
            jettonWalletAddress,
            extraCurrencyId,
            jettonWalletCode,
            content,
        };
    }
}
