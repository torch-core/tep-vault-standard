import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { beginCell, toNano } from '@ton/core';
import { VaultErrors } from '../wrappers/constants/error';
import { JettonMaster } from '@ton/ton';
import { Opcodes } from '../wrappers/constants/op';
import { OPCODE_SIZE, QUERY_ID_SIZE } from '../wrappers/constants/size';
import { compile } from '@ton/blueprint';
import { writeFileSync } from 'fs';

describe('Deploy Vault', () => {
    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let maxey: SandboxContract<TreasuryContract>;
    let USDC: SandboxContract<JettonMaster>;
    let USDCVault: SandboxContract<Vault>;
    let USDTVault: SandboxContract<Vault>;

    const { getTestContext, resetToInitSnapshot, deployJettonMinter } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, admin, maxey, USDTVault } = getTestContext());
    });

    afterAll(() => {
        const coverage1 = blockchain.coverage(USDTVault);
        if (!coverage1) return;

        // Generate HTML report for detailed analysis
        const coverageJson1 = coverage1.toJson();
        writeFileSync('./coverage/deploy-vault-usdt.json', coverageJson1);

        const coverage2 = blockchain.coverage(USDCVault);
        if (!coverage2) return;

        // Generate HTML report for detailed analysis
        const coverageJson2 = coverage2.toJson();
        writeFileSync('./coverage/deploy-vault-usdc.json', coverageJson2);
    });

    describe('Deploy failure cases', () => {
        it('should throw ERR_UNAUTHORIZED_ADMIN when deploy vault with unauthorized admin', async () => {
            // Deploy USDT Vault
            USDC = await deployJettonMinter(blockchain, admin, 'USDC');
            const vaultCode = await compile('Vault');
            const jettonWalletCode = await compile('JettonWallet');

            USDCVault = blockchain.openContract(
                Vault.createFromConfig(
                    {
                        adminAddress: admin.address,
                        totalSupply: 0n,
                        totalAssets: 0n,
                        masterAddress: USDC.address,
                        jettonWalletCode,
                        content: beginCell().endCell(),
                    },
                    vaultCode,
                ),
            );
            const deployUSDTVaultResult = await USDCVault.sendDeploy(maxey.getSender());
            expect(deployUSDTVaultResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: USDCVault.address,
                op: Opcodes.Vault.DeployVault,
                success: false,
                exitCode: VaultErrors.UnauthorizedAdmin,
            });
        });

        it('should throw ERR_INVALID_JETTON_MASTER when invalid jetton master send OP_RESPONSE_WALLET_ADDRESS to vault', async () => {
            const deployResult = await maxey.send({
                to: USDTVault.address,
                body: beginCell()
                    .storeUint(Opcodes.Jetton.ResponseWalletAddress, OPCODE_SIZE)
                    .storeUint(0, QUERY_ID_SIZE)
                    .storeAddress(maxey.address)
                    .storeMaybeRef(null)
                    .endCell(),
                value: toNano('0.01'),
            });
            expect(deployResult.transactions).toHaveTransaction({
                from: maxey.address,
                to: USDTVault.address,
                op: Opcodes.Jetton.ResponseWalletAddress,
                success: false,
                exitCode: VaultErrors.InvalidJettonMaster,
            });
        });
    });
});
