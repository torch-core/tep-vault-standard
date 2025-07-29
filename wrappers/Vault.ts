import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';
import { OPCODE_SIZE, QUERY_ID_SIZE } from './constants/size';
import { VaultOpcodes } from './constants/op';

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

export class Vault implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Vault(address);
    }

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        const data = vaultConfigToCell(config);
        const init = { code, data };
        return new Vault(contractAddress(workchain, init), init);
    }

    static createDeployVaultArg(queryId?: bigint) {
        return {
            value: toNano('0.08'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(VaultOpcodes.DeployVault, OPCODE_SIZE)
                .storeUint(queryId ?? 8n, QUERY_ID_SIZE)
                .endCell(),
        };
    }

    async sendDeploy(provider: ContractProvider, via: Sender, queryId?: bigint) {
        await provider.internal(via, Vault.createDeployVaultArg(queryId));
    }

    async getCounter(provider: ContractProvider) {
        const result = await provider.get('currentCounter', []);
        return result.stack.readNumber();
    }

    async getID(provider: ContractProvider) {
        const result = await provider.get('initialId', []);
        return result.stack.readNumber();
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
