import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Vault } from '../wrappers/Vault';
import '@ton/test-utils';
import { createTestEnvironment } from './helper/setup';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Opcodes } from '../wrappers/constants/op';
import { OPCODE_SIZE, QUERY_ID_SIZE, TIMESTAMP_SIZE } from '../wrappers/constants/size';
import { writeFileSync } from 'fs';
import { VaultErrors } from '../wrappers/constants/error';
import { Asset } from '@torch-finance/core';
import { JettonMaster } from '@ton/ton';
import { PROVIDE_QUOTE_GAS } from './helper/constants';
import { expectQuotedEmitLog } from './helper/emitLog';

describe('Query Quote', () => {
    jest.setTimeout(30000);
    let blockchain: Blockchain;
    let contractToQuery: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let tonVault: SandboxContract<Vault>;
    let USDTVault: SandboxContract<Vault>;
    let ecVault: SandboxContract<Vault>;
    let USDT: SandboxContract<JettonMaster>;
    let tonVaultTotalSupply: bigint;
    let tonVaultTotalAssets: bigint;
    let USDTVaultTotalSupply: bigint;
    let USDTVaultTotalAssets: bigint;
    let ecVaultTotalSupply: bigint;
    let ecVaultTotalAssets: bigint;
    let ecId: number;
    let tonAsset: Asset;
    let jettonAsset: Asset;
    let ecAsset: Asset;

    const queryId = 8n;
    const forwardPayload = beginCell().storeUint(1, 32).endCell();
    const { getTestContext, resetToInitSnapshot } = createTestEnvironment();

    beforeEach(async () => {
        await resetToInitSnapshot();
        ({ blockchain, maxey: contractToQuery, USDTVault, tonVault, bob, USDT, ecVault, ecId } = getTestContext());
        tonAsset = Asset.ton();
        jettonAsset = Asset.jetton(USDT.address);
        ecAsset = Asset.extraCurrency(ecId);
        blockchain.now = Math.floor(Date.now() / 1000);

        // Deposit 1 TON to tonVault
        const tonDepositArgs = await tonVault.getTonDepositArg({
            queryId,
            depositAmount: toNano('1'),
            depositParams: {
                receiver: USDTVault.address,
            },
        });
        await bob.send(tonDepositArgs);

        const tonVaultStorage = await tonVault.getStorage();
        tonVaultTotalSupply = tonVaultStorage.totalSupply;
        tonVaultTotalAssets = tonVaultStorage.totalAssets;

        // Deposit 1000 JT to USDTVault
        const jettonDepositArgs = await USDTVault.getJettonDepositArg(bob.address, {
            queryId,
            depositAmount: toNano('1000'),
        });
        await bob.send(jettonDepositArgs);

        const USDTVaultStorage = await USDTVault.getStorage();
        USDTVaultTotalSupply = USDTVaultStorage.totalSupply;
        USDTVaultTotalAssets = USDTVaultStorage.totalAssets;

        // Deposit 1000 ecId:0 to ecVault
        const ecDepositArgs = await ecVault.getEcDepositArg({
            queryId,
            depositAmount: toNano('1000'),
        });
        await bob.send(ecDepositArgs);

        const ecVaultStorage = await ecVault.getStorage();
        ecVaultTotalSupply = ecVaultStorage.totalSupply;
        ecVaultTotalAssets = ecVaultStorage.totalAssets;
    });

    afterAll(() => {
        const jettonVaultCoverage = blockchain.coverage(USDTVault);
        if (!jettonVaultCoverage) return;

        // Generate HTML report for detailed analysis
        const jettonVaultCoverageJson = jettonVaultCoverage.toJson();
        writeFileSync('./coverage/jetton-vault-provide-quote.json', jettonVaultCoverageJson);

        const tonVaultCoverage = blockchain.coverage(tonVault);
        if (!tonVaultCoverage) return;

        // Generate HTML report for detailed analysis
        const tonVaultCoverageJson = tonVaultCoverage.toJson();
        writeFileSync('./coverage/ton-vault-provide-quote.json', tonVaultCoverageJson);

        const ecVaultCoverage = blockchain.coverage(ecVault);
        if (!ecVaultCoverage) return;

        // Generate HTML report for detailed analysis
        const ecVaultCoverageJson = ecVaultCoverage.toJson();
        writeFileSync('./coverage/ec-vault-provide-quote.json', ecVaultCoverageJson);
    });

    function buildProvideQuotePayload(
        queryId: bigint,
        receiver: Address,
        forwardPayload?: Cell,
        optionalQuoteParams?: Cell,
    ) {
        return beginCell()
            .storeUint(Opcodes.Vault.ProvideQuote, OPCODE_SIZE)
            .storeUint(queryId, QUERY_ID_SIZE)
            .storeMaybeRef(null) // this repo is single-asset vault, so quoteAsset is always null
            .storeAddress(receiver)
            .storeMaybeRef(optionalQuoteParams)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }

    function buildTakeQuotePayload(
        queryId: bigint,
        initiator: Address,
        quoteAsset: Asset | null,
        totalSupply: bigint,
        totalAssets: bigint,
        timestamp: number,
        forwardPayload?: Cell,
    ) {
        return beginCell()
            .storeUint(Opcodes.Vault.TakeQuote, OPCODE_SIZE)
            .storeUint(queryId, QUERY_ID_SIZE)
            .storeAddress(initiator)
            .storeMaybeRef(null)
            .storeCoins(totalSupply)
            .storeCoins(totalAssets)
            .storeUint(timestamp, TIMESTAMP_SIZE)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }

    function expectProvideQuoteFlows(
        provideQuoteResult: SendMessageResult,
        vaultAddress: Address,
        quoteAsset: Asset,
        totalSupply: bigint,
        totalAssets: bigint,
        receiver?: Address,
        body?: Cell,
    ) {
        // Expect contractToQuery sent ProvideQuote message to tonVault
        expect(provideQuoteResult.transactions).toHaveTransaction({
            from: contractToQuery.address,
            to: vaultAddress,
            op: Opcodes.Vault.ProvideQuote,
            success: true,
        });

        if (body) {
            // Expect tonVault sent TakeQuote message to contractToQuery
            expect(provideQuoteResult.transactions).toHaveTransaction({
                from: vaultAddress,
                to: receiver ?? contractToQuery.address,
                op: Opcodes.Vault.TakeQuote,
                success: true,
                body,
            });
        } else {
            // Expect tonVault sent TakeQuote message to contractToQuery
            expect(provideQuoteResult.transactions).toHaveTransaction({
                from: vaultAddress,
                to: receiver ?? contractToQuery.address,
                op: Opcodes.Vault.TakeQuote,
                success: true,
            });
        }

        // Expect quoted emit log
        expectQuotedEmitLog(
            provideQuoteResult,
            contractToQuery.address,
            receiver ?? contractToQuery.address,
            quoteAsset,
            totalSupply,
            totalAssets,
        );
    }

    describe('Provide Quote from TON Vault', () => {
        it('should provide quote from TON Vault', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: tonVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                tonVault.address,
                tonAsset,
                tonVaultTotalSupply,
                tonVaultTotalAssets,
                contractToQuery.address,
            );
        });

        it('should provide quote from TON Vault with receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address);
            const provideQuoteResult = await contractToQuery.send({
                to: tonVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                tonVault.address,
                tonAsset,
                tonVaultTotalSupply,
                tonVaultTotalAssets,
                bob.address,
            );
        });

        it('should provide quote from TON Vault with forward payload', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: tonVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                tonVault.address,
                tonAsset,
                tonVaultTotalSupply,
                tonVaultTotalAssets,
                contractToQuery.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    tonAsset,
                    tonVaultTotalSupply,
                    tonVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should provide quote from TON Vault with forward payload and receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: tonVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                tonVault.address,
                tonAsset,
                tonVaultTotalSupply,
                tonVaultTotalAssets,
                bob.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    tonAsset,
                    tonVaultTotalSupply,
                    tonVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should throw ERR_INSUFFICIENT_PROVIDE_QUOTE_GAS when valueCoins < provide quote gas', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: tonVault.address,
                value: toNano('0.008'),
                body: provideQuotePayload,
            });

            expect(provideQuoteResult.transactions).toHaveTransaction({
                from: contractToQuery.address,
                to: tonVault.address,
                op: Opcodes.Vault.ProvideQuote,
                success: false,
                exitCode: VaultErrors.InsufficientProvideQuoteGas,
            });
        });
    });

    describe('Provide Quote from USDT Vault', () => {
        it('should provide quote from USDT Vault', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: USDTVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                USDTVault.address,
                jettonAsset,
                USDTVaultTotalSupply,
                USDTVaultTotalAssets,
                contractToQuery.address,
            );
        });

        it('should provide quote from USDT Vault with receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address);
            const provideQuoteResult = await contractToQuery.send({
                to: USDTVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                USDTVault.address,
                jettonAsset,
                USDTVaultTotalSupply,
                USDTVaultTotalAssets,
                bob.address,
            );
        });

        it('should provide quote from USDT Vault with forward payload', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: USDTVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                USDTVault.address,
                jettonAsset,
                USDTVaultTotalSupply,
                USDTVaultTotalAssets,
                bob.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    jettonAsset,
                    USDTVaultTotalSupply,
                    USDTVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should provide quote from USDT Vault with forward payload and receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: USDTVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                USDTVault.address,
                jettonAsset,
                USDTVaultTotalSupply,
                USDTVaultTotalAssets,
                bob.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    jettonAsset,
                    USDTVaultTotalSupply,
                    USDTVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should throw ERR_INSUFFICIENT_PROVIDE_QUOTE_GAS when valueCoins < provide quote gas', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: USDTVault.address,
                value: toNano('0.008'),
                body: provideQuotePayload,
            });

            expect(provideQuoteResult.transactions).toHaveTransaction({
                from: contractToQuery.address,
                to: USDTVault.address,
                op: Opcodes.Vault.ProvideQuote,
                success: false,
                exitCode: VaultErrors.InsufficientProvideQuoteGas,
            });
        });
    });

    describe('Provide Quote from Extra Currency Vault', () => {
        it('should provide quote from Extra Currency Vault', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: ecVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                ecVault.address,
                ecAsset,
                ecVaultTotalSupply,
                ecVaultTotalAssets,
                contractToQuery.address,
            );
        });

        it('should provide quote from Extra Currency Vault with receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address);
            const provideQuoteResult = await contractToQuery.send({
                to: ecVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                ecVault.address,
                ecAsset,
                ecVaultTotalSupply,
                ecVaultTotalAssets,
                bob.address,
            );
        });

        it('should provide quote from Extra Currency Vault with forward payload', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: ecVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                ecVault.address,
                Asset.extraCurrency(ecId),
                ecVaultTotalSupply,
                ecVaultTotalAssets,
                contractToQuery.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    ecAsset,
                    ecVaultTotalSupply,
                    ecVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should provide quote from Extra Currency Vault with forward payload and receiver', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, bob.address, forwardPayload);
            const provideQuoteResult = await contractToQuery.send({
                to: ecVault.address,
                value: toNano('0.5'),
                body: provideQuotePayload,
            });

            expectProvideQuoteFlows(
                provideQuoteResult,
                ecVault.address,
                ecAsset,
                ecVaultTotalSupply,
                ecVaultTotalAssets,
                bob.address,
                buildTakeQuotePayload(
                    queryId,
                    contractToQuery.address,
                    ecAsset,
                    ecVaultTotalSupply,
                    ecVaultTotalAssets,
                    blockchain.now!,
                    forwardPayload,
                ),
            );
        });

        it('should throw ERR_INSUFFICIENT_PROVIDE_QUOTE_GAS when valueCoins < provide quote gas for Extra Currency Vault', async () => {
            const provideQuotePayload = buildProvideQuotePayload(queryId, contractToQuery.address);
            const provideQuoteResult = await contractToQuery.send({
                to: ecVault.address,
                value: toNano('0.008'),
                body: provideQuotePayload,
            });

            expect(provideQuoteResult.transactions).toHaveTransaction({
                from: contractToQuery.address,
                to: ecVault.address,
                op: Opcodes.Vault.ProvideQuote,
                success: false,
                exitCode: VaultErrors.InsufficientProvideQuoteGas,
            });
        });
    });

    describe('Get methods', () => {
        it('should preview provide quote fee', async () => {
            const fee = await tonVault.getPreviewProvideQuoteFee();
            expect(fee).toBe(PROVIDE_QUOTE_GAS);
        });
    });
});
