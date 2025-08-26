import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { compile } from '@ton/blueprint';
import { Vault } from '../../wrappers/Vault';
import { JettonMinter } from '../../wrappers/mock-jetton/JettonMinter';
import { Opcodes } from '../../wrappers/constants/op';
import { JettonOpcodes } from '../../wrappers/mock-jetton/JettonConstants';
import { expectVaultStorage } from './expectVault';

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
        blockchain.verbosity = { ...blockchain.verbosity, print: false };
        blockchain.enableCoverage();
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
            op: Opcodes.Vault.DeployVault,
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

        const tonVaultJettonData = await tonVault.getJettonData();
        expect(tonVaultJettonData.totalSupply).toBe(0n);
        expect(tonVaultJettonData.mintable).toBe(true);
        expect(tonVaultJettonData.adminAddress.equals(admin.address)).toBeTruthy();
        expect(tonVaultJettonData.content.equals(content)).toBeTruthy();
        expect(tonVaultJettonData.walletCode.equals(jettonWalletCode)).toBeTruthy();

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
            op: Opcodes.Vault.DeployVault,
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

        const usdtVaultJettonData = await USDTVault.getJettonData();
        expect(usdtVaultJettonData.totalSupply).toBe(0n);
        expect(usdtVaultJettonData.mintable).toBe(true);
        expect(usdtVaultJettonData.adminAddress.equals(USDTVault.address)).toBeTruthy();
        expect(usdtVaultJettonData.content.equals(content)).toBeTruthy();
        expect(usdtVaultJettonData.walletCode.equals(jettonWalletCode)).toBeTruthy();

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

    const deployJettonMinter = async (
        blockchain: Blockchain,
        deployer: SandboxContract<TreasuryContract>,
        name: string,
        admin?: Address,
        decimals: number = 6,
        premint: bigint = 1000_000_000_000n,
    ) => {
        const jettonMinterCode = await compile('JettonMinter');
        const jettonWalletCode = await compile('JettonWallet');
        let jetton: SandboxContract<JettonMinter>;
        jetton = blockchain.openContract(
            await JettonMinter.createFromConfig(
                {
                    admin: admin ?? deployer.address,
                    wallet_code: jettonWalletCode,
                    jetton_content: { uri: name },
                },
                jettonMinterCode,
            ),
        );

        await jetton.sendDeploy(deployer.getSender(), toNano('1.5'));

        // Mint some tokens to admin
        await jetton.sendMint(deployer.getSender(), deployer.address, premint * BigInt(10 ** decimals));

        return jetton;
    };

    return {
        resetToInitSnapshot,
        getTestContext,
        deployJettonMinter,
    };
};
