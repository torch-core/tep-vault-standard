import { beginCell, Cell } from '@ton/core';
import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { compile } from '@ton/blueprint';
import { Vault } from '../../wrappers/Vault';
import { JettonMinter } from '../../wrappers/jetton/JettonMinter';
import { deployJettonMinter } from './jetton';
import { VaultOpcodes } from '../../wrappers/constants/op';
import { JettonOpcodes } from '../../wrappers/jetton/JettonConstants';
import { expectVaultStorage } from './expect';

export const createTestEnvironment = () => {
    // Blockchain
    let blockchain: Blockchain;
    let initSnapshot: BlockchainSnapshot | null = null;

    // Codes
    let vaultCode: Cell;
    let jettonWalletCode: Cell;

    // Vaults
    let tonVault: SandboxContract<Vault>;
    let USDTVault: SandboxContract<Vault>;

    // Roles
    let admin: SandboxContract<TreasuryContract>;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let USDT: SandboxContract<JettonMinter>;

    beforeAll(async () => {
        vaultCode = await compile('Vault');
        jettonWalletCode = await compile('JettonWallet');
        blockchain = await Blockchain.create();
        [admin, maxey, bob] = await Promise.all([
            blockchain.treasury('admin'),
            blockchain.treasury('maxey'),
            blockchain.treasury('bob'),
        ]);
        const content = beginCell().endCell();

        // Deploy TON Vault
        tonVault = blockchain.openContract(
            Vault.createFromConfig(
                {
                    adminAddress: admin.address,
                    totalSupply: 0n,
                    totalAssets: 0n,
                    jettonWalletCode,
                    content,
                },
                vaultCode,
            ),
        );
        const deployTONVaultResult = await tonVault.sendDeploy(admin.getSender());
        expect(deployTONVaultResult.transactions).toHaveTransaction({
            from: admin.address,
            to: tonVault.address,
            deploy: true,
            success: true,
            op: VaultOpcodes.DeployVault,
        });
        // Check TON Vault storage
        const tonVaultStorage = await tonVault.getStorage();
        expectVaultStorage(tonVaultStorage, {
            adminAddress: admin.address,
            totalSupply: 0n,
            totalAssets: 0n,
            jettonMaster: null,
            jettonWalletAddress: null,
            jettonWalletCode,
            content,
        });

        // Deploy USDT Vault
        USDT = await deployJettonMinter(blockchain, admin, 'USDT');

        // Mint USDT to maxey and bob
        await Promise.all([
            USDT.sendMint(admin.getSender(), maxey.address, 1000_000_000_000n),
            USDT.sendMint(admin.getSender(), bob.address, 1000_000_000_000n),
        ]);

        USDTVault = blockchain.openContract(
            Vault.createFromConfig(
                {
                    adminAddress: admin.address,
                    totalSupply: 0n,
                    totalAssets: 0n,
                    masterAddress: USDT.address,
                    jettonWalletCode,
                    content,
                },
                vaultCode,
            ),
        );
        const deployUSDTVaultResult = await USDTVault.sendDeploy(admin.getSender());
        expect(deployUSDTVaultResult.transactions).toHaveTransaction({
            from: admin.address,
            to: USDTVault.address,
            deploy: true,
            success: true,
            op: VaultOpcodes.DeployVault,
        });

        // USDT Jetton Master should send OP_TAKE_WALLET_ADDRESS to USDTVault
        expect(deployUSDTVaultResult.transactions).toHaveTransaction({
            from: USDT.address,
            to: USDTVault.address,
            success: true,
            op: JettonOpcodes.TakeWalletAddress,
        });

        // Check USDTVault storage
        const usdtVaultStorage = await USDTVault.getStorage();
        expectVaultStorage(usdtVaultStorage, {
            adminAddress: admin.address,
            totalSupply: 0n,
            totalAssets: 0n,
            jettonMaster: USDT.address,
            jettonWalletAddress: await USDT.getWalletAddress(USDTVault.address),
            jettonWalletCode,
            content,
        });

        initSnapshot = blockchain.snapshot();
    });

    // restore blockchain to initial state
    const resetToInitSnapshot = async () => {
        if (initSnapshot) {
            await blockchain.loadFrom(initSnapshot);
        }
    };

    const getTestContext = () => {
        return {
            blockchain,
            admin,
            maxey,
            bob,
            USDT,
            tonVault,
            USDTVault,
        };
    };

    return {
        resetToInitSnapshot: resetToInitSnapshot,
        getTestContext,
    };
};
