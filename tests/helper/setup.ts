import { Address, beginCell, Cell, toNano } from '@ton/core';
import {
    Blockchain,
    BlockchainSnapshot,
    internal,
    printTransactionFees,
    SandboxContract,
    TreasuryContract,
} from '@ton/sandbox';
import { compile } from '@ton/blueprint';
import { Vault } from '../../wrappers/Vault';
import { JettonMinter } from '../../wrappers/mock-jetton/JettonMinter';
import { Opcodes } from '../../wrappers/constants/op';
import { JettonOpcodes } from '../../wrappers/mock-jetton/JettonConstants';
import { expectVaultStorage } from './expectVault';

export const expectVaultJettonData = async (
    vault: SandboxContract<Vault>,
    expected: {
        totalSupply: bigint;
        mintable: boolean;
        adminAddress: Address;
        content: Cell;
        jettonWalletCode: Cell;
    },
) => {
    const jettonData = await vault.getJettonData();
    expect(jettonData.totalSupply).toBe(expected.totalSupply);
    expect(jettonData.mintable).toBe(expected.mintable);
    expect(jettonData.adminAddress.equals(expected.adminAddress)).toBeTruthy();
    expect(jettonData.content.equals(expected.content)).toBeTruthy();
    expect(jettonData.walletCode.equals(expected.jettonWalletCode)).toBeTruthy();
};

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
    let ecVault: SandboxContract<Vault>;

    // Roles
    let admin: SandboxContract<TreasuryContract>;
    let maxey: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let USDT: SandboxContract<JettonMinter>;

    const ecId = 0;

    beforeAll(async () => {
        vaultCode = await compile('Vault');
        jettonWalletCode = await compile('JettonWallet');
        blockchain = await Blockchain.create();
        blockchain.verbosity = { ...blockchain.verbosity, print: true };
        // blockchain.enableCoverage();
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
            extraCurrencyId: null,
            jettonWalletCode,
            content,
        });

        await expectVaultJettonData(tonVault, {
            totalSupply: 0n,
            mintable: true,
            adminAddress: admin.address,
            content,
            jettonWalletCode,
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
            extraCurrencyId: null,
            jettonWalletCode,
            content,
        });

        await expectVaultJettonData(USDTVault, {
            totalSupply: 0n,
            mintable: true,
            adminAddress: admin.address,
            content,
            jettonWalletCode,
        });

        // Deploy EC Vault
        ecVault = blockchain.openContract(
            Vault.createFromConfig(
                {
                    adminAddress: admin.address,
                    totalSupply: 0n,
                    totalAssets: 0n,
                    extraCurrencyId: ecId,
                    jettonWalletCode,
                    content,
                },
                vaultCode,
            ),
        );
        const deployECVaultResult = await ecVault.sendDeploy(admin.getSender());
        expect(deployECVaultResult.transactions).toHaveTransaction({
            from: admin.address,
            to: ecVault.address,
            deploy: true,
            success: true,
            op: Opcodes.Vault.DeployVault,
        });

        // Check EC Vault storage
        const ecVaultStorage = await ecVault.getStorage();
        expectVaultStorage(ecVaultStorage, {
            adminAddress: admin.address,
            totalSupply: 0n,
            totalAssets: 0n,
            jettonMaster: null,
            jettonWalletAddress: null,
            extraCurrencyId: ecId,
            jettonWalletCode,
            content,
        });

        await expectVaultJettonData(ecVault, {
            totalSupply: 0n,
            mintable: true,
            adminAddress: admin.address,
            content,
            jettonWalletCode,
        });

        // Make sure every wallets have extra currency id 0
        for (const wallet of [maxey, bob, admin]) {
            await blockchain.sendMessage(
                internal({
                    to: wallet.address,
                    from: new Address(0, Buffer.alloc(32)),
                    value: toNano('1'),
                    ec: [[ecId, toNano('100000')]],
                }),
            );
        }

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
            ecVault,
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
