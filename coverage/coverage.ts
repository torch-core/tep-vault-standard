import { Coverage } from '@ton/sandbox';
import { readFileSync, writeFileSync } from 'fs';

function main() {
    // Merge coverage data in separate script after tests
    const tonVaultDepositCoverage = Coverage.fromJson(readFileSync('./coverage/ton-vault-deposit.json', 'utf-8'));
    const jettonVaultDepositCoverage = Coverage.fromJson(readFileSync('./coverage/jetton-vault-deposit.json', 'utf-8'));
    const tonVaultWithdrawCoverage = Coverage.fromJson(readFileSync('./coverage/ton-vault-withdraw.json', 'utf-8'));
    const jettonVaultWithdrawCoverage = Coverage.fromJson(readFileSync('./coverage/jetton-vault-withdraw.json', 'utf-8'));
    const jettonQuoteCoverage = Coverage.fromJson(readFileSync('./coverage/jetton-vault-provide-quote.json', 'utf-8'));
    const tonQuoteCoverage = Coverage.fromJson(readFileSync('./coverage/ton-vault-provide-quote.json', 'utf-8'));
    const totalCoverage = tonVaultDepositCoverage
        .mergeWith(jettonVaultDepositCoverage)
        .mergeWith(tonVaultWithdrawCoverage)
        .mergeWith(jettonVaultWithdrawCoverage)
        .mergeWith(jettonQuoteCoverage)
        .mergeWith(tonQuoteCoverage);
    const htmlReport = totalCoverage.report('html');
    writeFileSync('./coverage/coverage.html', htmlReport);
    console.log(`Combined coverage: ${totalCoverage.summary().coveragePercentage}%`);
}

main();
