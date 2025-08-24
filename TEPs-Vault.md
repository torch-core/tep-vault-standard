# TEP-4626: Tokenized Vaults Standard for TON Blockchain

**Status**: Draft  
**Type**: Application  
**Author**: [@throwunless]  
**Created**: 2025-08-04  
**Requires**: TEP-74, TEP-64  

## Summary

This proposal defines a standardized API for tokenized vaults on the TON blockchain, built upon the [TEP-74 Jetton standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md) and inspired by the design principles of [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626). It is adapted to TON’s **message-driven async design** and Jetton framework.  

The standard supports **deposit, withdrawal, and conversion rate queries**. It also introduces a standardized **cross-protocol communication interface** with unified notification mechanisms for operation results and callbacks.  

By unifying these core operations, the standard enhances **composability and interoperability** in TON’s DeFi ecosystem. It reduces duplicated implementations, minimizes fragmentation across protocols, and enables developers to build consistent and efficient vault logic.  

Readers are encouraged to review the [ERC-4626 standard](https://eips.ethereum.org/EIPS/eip-4626) for additional background and context.

## Motivation

While TON has a powerful asynchronous and message-driven architecture, its ecosystem is hindered by a lack of standardization for tokenized vaults. This has resulted in fragmented implementations, making protocol integration more complex. Key issues include:

- **Inconsistent Callbacks**: Success/failure payload formats vary across implementations, which complicates subsequent operations or rollbacks in interacting protocols—especially in TON's asynchronous message-passing environment—increasing error risks.
- **Non-Uniform Query Interfaces**: Get methods use inconsistent names and structures, forcing frontends and wallets to implement custom logic for each protocol. For example, some expose only the Jetton balance, while others require applying a conversion rate to show real asset value.
- **Divergent Event Formats**: Emitted events use varied formats, making it difficult for off-chain systems to monitor and parse events uniformly.
- **Inconsistent On-Chain Rate Queries**: Vaults provide rate information through different message-based query formats, forcing aggregators to implement multiple parsing logics. This increases development complexity and integration costs.
- **Lack of Gas Estimation Standards**: No unified method to query gas consumption, making it difficult for developers to estimate interaction costs.
- **Varied Deposit/Withdrawal Processes**: Deposit and withdrawal flows and parameters differ across vaults, including how Jetton transfers and burn notifications are handled, increasing development complexity and integration costs.
  
These issues force protocols to develop custom adapters, increasing errors, costs, and development time. 

TEP-4626 addresses these by standardizing vault interfaces, reducing integration complexity, and accelerating TON’s DeFi ecosystem growth. By aligning with proven models like ERC-4626 while adapting to TON’s asynchronous, message-driven architecture and sharding design, this standard provides a solid foundation for scalable and reliable DeFi applications on TON.

## Guide

[TEPs-Vault Standard Implementation](https://github.com/ipromise2324/tep-vault-standard)

## Specification

All TEP-4626 tokenized vaults MUST implement the [TEP-74](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md) Jetton standard to represent shares. Shares represent partial ownership of the vault’s underlying assets.

For non-transferable vaults, the Jetton Wallet MAY adopt a status flag mechanism—similar to the approach used in [stablecoin contracts](https://github.com/ton-blockchain/stablecoin-contract/blob/56fd5b983f18288d42d65ab9c937f3637e27fa0d/contracts/jetton-wallet.fc#L11)—to restrict transfers.

All `TEP-4626` vaults MUST implement [`TEP-64`](https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md) Jetton metadata. The `name` and `symbol` functions SHOULD reflect the underlying asset’s name and symbol to some extent.

### Definitions

- **`asset`**: The underlying token managed by the vault, with units defined by its Jetton Master contract. This vault design supports managing multiple underlying assets.
- **`share`**: Jetton issued by the vault, representing a claim on underlying assets with a conversion rate defined by the vault during deposit/withdrawal.
- **`fee`**: Amounts of assets or shares charged by the vault, applicable to deposits, yields, assets under management (AUM), withdrawals, or other vault-specified items.
- **`slippage`**: The difference between the advertised share price and the actual economic outcome during deposit/withdrawal, excluding fees.
- **`baseAsset`**: The primary or default underlying asset for vault calculations, used for standardization in multi-asset scenarios. For single-asset vaults, it is the sole asset. If no other specified asset is provided, the vault will utilize the base asset for exchange rate conversions and output standardization, to ensure operational consistency and simplify integrations.
- **`XXX_FP`**: If a name ends with `_FP` (e.g., `OP_DEPOSIT_FP`), it refers to fields in `forwardPayload` (Jetton Notification) or `customPayload` (Burn Notification). Names without `_FP` (e.g., `OP_DEPOSIT`) refer to actions involving TON transfers.

### Vault Smart Contract

#### General Types

- **`Opcode`**: `uint32`  
- **`QueryId`**: `uint64`
- **`Timestamp`**: `uint32`  
- **`Hash`**: `uint256`
- **`RoundingType`**: `uint2`  
  - `ROUND_DOWN = 0`  
  - `ROUND_UP = 1`  
  - `ROUND_GENERIC = 2` — standard rounding (i.e., round half up)  
- **`Result`**: `uint16`  
  - Outcome of the vault operation.  
  - Values: `0` (success), error codes (e.g., `1`: Insufficient amount, `2`: Limit exceeded).  
- **`Asset`**: Represents various asset types (TON, Jetton, Extra Currency) using a compact encoding scheme for unified handling.

  **Format**  
  Each asset is encoded using a 4-bit prefix, read via `preloadUint(4)`, followed by type-specific data:

  | Prefix (bin) | Type                  | Additional Data                     |
  |--------------|-----------------------|-------------------------------------|
  | `0000`       | **TON (native)**      | —                                   |
  | `0001`       | **Jetton**         | `jettonMasterAddress` (`Address`)   |
  | `0010`       | **Extra Currency (XC)** | `tokenId` (`uint32`), not enabled for now |

  **Encoding Examples (Tolk)**
  ```tolk
  // Native TON
  beginCell().storeUint(0, 4).endCell()

  // Jetton
  beginCell().storeUint(1, 4).storeAddress(jettonMasterAddress).endCell()

  // Extra Currency (XC)
  beginCell().storeUint(2, 4).storeUint(token_id, 32).endCell()
  ```
- **`Nested<Cell<T>>`**: Because TON's Cell can have at most 4 references, if you need to store more than 4 references of the same type data structure, we will enable `Nested<Cell<T>>`, where access is such that 1 cell holds at most 3 references, and the remaining one reference is used to connect to the next layer cell, and then the next layer cell can continue to store at most 3 references and so on, as shown in the diagram below.
![nested-cell](./assets/nested-cell.png)

#### Storage

Vault contracts MUST implement the following persistent storage variables in the contract’s data cell, extending `TEP-74` Jetton storage requirements, as shares are represented as Jetton.

##### TEP-74 Required Storage

- **`totalSupply`**
  - **Description**: Total supply of vault shares, represented as Jetton.
  - **Requirements**: MUST represent the total outstanding shares issued by the vault.
  - **Type**: `Coins`

- **`adminAddress`**
  - **Description**: The administrative address for the vault contract.
  - **Requirements**: SHOULD deploy the contract and set Jetton Master parameters when the underlying asset is a Jetton, ensuring correct provide and take jetton wallet address interactions.
  - **Type**: `Address`

- **`jettonContent`**
  - **Description**: Metadata cell for Jetton shares, compliant with `TEP-64` (Token Data Standard).
  - **Requirements**: 
    - MUST contain token metadata (`name`, `symbol`, `decimals`). `name` and `symbol` 
    - SHOULD include both the vault provider’s information and the underlying asset’s details in the token metadata, with `name` and `symbol` reflecting the underlying asset.
  - **Type**: `Cell`

- **`jettonWalletCode`**
  - **Description**: Code cell for the Jetton wallet contract associated with vault shares.
  - **Requirements**: MUST comply with `TEP-74`.
  - **Type**: `Cell`

##### Vault-Specific Storage

###### Single-Asset Storage

For vaults managing a single underlying asset, the following persistent storage variables MUST be implemented in the contract’s data cell, extending TEP-74 Jetton storage requirements.

- **`totalAssets`**
  - **Description**: Total amount of the underlying asset managed by the vault.
  - **Requirements**:
    - SHOULD include compounding from yield or accrued fees.
    - MUST include fees charged against managed assets.
  - **Type**: `Coins`

- **`assetMasterAddress`**
  - **Description**: Jetton Master address of the underlying asset, if a Jetton.
  - **Requirements**:
    - MUST be present if the underlying asset is a Jetton.
    - MUST NOT be present if the asset is TON.
  - **Type**: `Address`

- **`assetWalletAddress`**
  - **Description**: Vault’s Jetton Wallet address for the underlying asset, if a Jetton.
  - **Requirements**:
    - MUST be present if the underlying asset is a Jetton to facilitate transfers and operations.
    - MUST NOT be present if the asset is TON.
  - **Type**: `Address`

###### Multi-Asset Storage

For vaults managing multiple underlying assets, the following persistent storage variables MUST be implemented in the contract’s data cell. These use dictionaries for mapping and a nested cell for efficient handling of numerous assets.

- **`totalAssetsDict`**
  - **Description**: Dictionary mapping underlying asset identifiers to the total amounts managed by the vault.
  - **Requirements**:
    - Key MUST be the hash (`uint256`) of the `Asset` cell, computed as `Asset.toCell().hash()`.
    - Values SHOULD include compounding from yield or accrued fees.
    - MUST include fees charged against managed assets.
  - **Type**: `Dict<Hash, Coins>`

- **`assetMastersDict`**
  - **Description**: Dictionary mapping Jetton Master address to the vault's corresponding Jetton Wallet address.
  - **Requirements**:
    - Key MUST be the Jetton Master address.
    - Value MUST be the vault's Jetton Wallet address for that asset.
    - MUST include entries for all Jetton assets managed.
    - MUST NOT be present if the asset is TON.
  - **Type**: `Dict<Address, Address>`

- **`assetWalletsDict`**
  - **Description**: Dictionary mapping the vault's Jetton Wallet address to their corresponding Jetton Master address.
  - **Requirements**:
    - Key MUST be the vault's Jetton Wallet address.
    - Value MUST be the Jetton Master address for that asset.
    - MUST mirror `assetMastersDict` (inverted key-value pairs for bidirectional lookup).
    - MUST include entries for all Jetton assets managed.
    - MUST NOT be present if the asset is TON.
  - **Type**: `Dict<Address, Address>`

- **`assetsCell`**
  - **Description**: Cell of a nested structure (`Nested<Cell<Asset>>`) for storing underlying asset data in multi-asset vaults.
  - **Requirements**:
    - MUST contain all underlying assets accepted by the vault.
  - **Type**: `Cell`

#### Internal Messages

**Vault Notification**

![vault-notification](./assets/vault-notification.png)

- **Description**: After vault interaction (`Deposit` or `Withdraw`), the vault sends a notification message to the receiver or initiator, with user-defined callback payloads for further operations.

- **Messages**:
  - **`VaultOptions`**

    | Field            | Type   | Description |
    |------------------|--------|-------------|
    | *(user-defined)* | `any` | Optional parameters used across deposit, withdraw, and query quote messages. Its structure is not predefined — developers may include data such as **off-chain computed prices**, **signature payloads**, or **referral information**. |

  - **`VaultConfig`**

    | Field                  | Type   | Description |
    |------------------------|--------|-------------|
    | *(user-defined)* | `any` | Internal configuration struct resolved from `VaultOptions`. Represents processed and validated parameters, such as a **verified price** used in vault operations. |


  - **`CallbackParams`**:

    | Field       | Type | Description |
    |-------------|------|-------------|
    | `includeBody` | `Bool` | Whether to include the Vault interaction message payload (e.g., OP_DEPOSIT) in the response to the `receiver`/`initiator`. |
    | `payload`     | `Cell` | If defined, sends user-defined callback payload to `receiver` (on success) or `initiator` (on failure). |

  - **`Callbacks`**:

    | Field             | Type                   | Description |
    |-------------------|------------------------|-------------|
    | `successCallback`   | `Cell<CallbackParams>?` | Sends `successCallback.payload` to `receiver` on successful vault interaction. |
    | `failureCallback`   | `Cell<CallbackParams>?` | Sends `failureCallback.payload` to `initiator` on failed vault interaction. |

  - **`VaultNotificationParams`**:

    | Field           | Type    | Description |
    |-----------------|---------|-------------|
    | `result`          | `Result`  | Outcome of the vault operation. |
    | `initiator`       | `Address` | Address initiating the vault interaction. |
    | `callbackPayload` | `Cell?`   | `successCallback.payload` (on success) or `failureCallback.payload` (on failure). Null if not specified in `CallbackParams`. |
    | `inBody`          | `Cell?`   | The vault Interaction message payload if `includeBody` is `true`; otherwise, null. |

  - **`OP_VAULT_NOTIFICATION`**: For `Withdraw` or TON refund.

    | Field                    | Type                   | Description |
    |--------------------------|------------------------|-------------|
    | `OP_VAULT_NOTIFICATION`    | `Opcode`                 | `0x86eba146` |
    | `queryId`                  | `QueryId`                | Unique query identifier. |
    | `vaultNotificationParams`  | `VaultNotificationParams`|  |

  - **`OP_VAULT_NOTIFICATION_FP`**: For minting shares, withdrawing, or refunding Jetton.

    | Field                    | Type                   | Description |
    |--------------------------|------------------------|-------------|
    | `OP_VAULT_NOTIFICATION_FP` | `Opcode`                 | `0xb00d7656` |
    | `vaultNotificationParams`  | `VaultNotificationParams`|  |

**Deposit (For TON)**

![deposit-ton](./assets/deposit-ton.png)

- **Description**: Mint shares to `receiver` by depositing exactly `depositAmount` of TON.
- **Requirements**:
  - MUST verify `in.valueCoins` covers `depositAmount` plus required gas.
  - If deposit fails (e.g., `depositAmount` exceeds vault limit or minted shares < `minShares`), MUST refund TON and send `OP_VAULT_NOTIFICATION` with `failureCallback.payload` to `initiator`.
  - On successful share minting, MUST send `OP_VAULT_NOTIFICATION_FP` with `successCallback.payload` to `receiver`.
  - If `receiver` is address none, SHOULD set `receiver` to `initiator`.
  - MUST emit `TOPIC_DEPOSITED` event.

- **Message**:
  - **`DepositOptions`**

    | Field        | Type                 | Description |
    |--------------|----------------------|-------------|
    | `vaultOptions` | `Cell<VaultOptions>?` | Reference to common options shared across vault operations (deposit, withdraw, query quote). |
    | *(user-defined)* | `any` | Deposit-specific parameters defined by the developer. |

  - **`DepositParams`**:

    | Field          | Type                   | Description |
    |----------------|------------------------|-------------|
    | `receiver`       | `Address`                | Address receiving vault share jetton and callback payload. |
    | `minShares`      | `Coins`                  | Minimum shares to receive, else refund. |
    | `depositOptions` | `Cell<DepositOptions>?`  | Optional parameters (e.g., price data). |
    | `callbacks`      | `Callbacks`              | Success and failure callbacks. |

  | Field        | Type          | Description |
  |--------------|---------------|-------------|
  | `OP_DEPOSIT`   | `Opcode`        | `0x5a66a4a5` |
  | `queryId`      | `QueryId`       | Unique query identifier. |
  | `depositAmount`| `Coins`         | TON amount to deposit. |
  | `depositParams`| `DepositParams` |  |

**Deposit Forward Payload (For Jetton)**

![deposit-jetton](./assets/deposit-jetton.png)

- **Description**: Mint shares to `receiver` by depositing exactly `depositAmount` of Jetton.
- **Requirements**:
  - MUST verify `in.valueCoins` covers required gas.
  - MUST verify `in.senderAddress` matches the vault’s underlying Jetton Wallet address.
  - If deposit fails (e.g., `depositAmount` exceeds vault limit or minted shares < `minShares`), MUST refund Jetton and send `OP_VAULT_NOTIFICATION_FP` with `failureCallback.payload` to `initiator`.
  - On successful share minting, MUST send `OP_VAULT_NOTIFICATION_FP` with `successCallback.payload` to `receiver`.
  - If `receiver` is address none, SHOULD set `receiver` to `initiator`.
  - MUST emit `TOPIC_DEPOSITED` event.

- **Message**:

  | Field         | Type          | Description |
  |---------------|---------------|-------------|
  | `OP_DEPOSIT_FP` | `Opcode`        | `0xb534fe7b` |
  | `depositParams` | `DepositParams` | Deposit parameters. |

**Withdraw (In Burn Notification)**

![withdraw](./assets/withdraw.png)

- **Description**: Burns exactly `shares` from `initiator` and sends underlying assets to `receiver`.
- **Requirements**:
  - MUST verify `in.valueCoins` covers required gas.
  - MUST verify `in.senderAddress` is the Jetton Wallet of the shares, not another Jetton wallet.
  - If withdrawal fails (e.g., burned shares exceed vault limit or withdrawn amount < `minWithdraw`), MUST refund shares and send `OP_VAULT_NOTIFICATION_FP` with `failureCallback.payload` to `initiator`.
  - On successful withdrawal, MUST send `OP_VAULT_NOTIFICATION_FP` (for Jetton) or `OP_VAULT_NOTIFICATION` (for TON) with `successCallback.payload` to `receiver`.
  - If `receiver` is address none, SHOULD set `receiver` to `initiator`.
  - MUST emit `TOPIC_WITHDRAWN` event.

- **Message**:
  - **`WithdrawOptions`**

    | Field        | Type                 | Description |
    |--------------|----------------------|-------------|
    | `vaultOptions` | `Cell<VaultOptions>?` | Reference to common options shared across vault operations (deposit, withdraw, query quote). |
    | *(user-defined)* | `any` | Withdraw-specific parameters defined by the developer. |

  | Field               | Type                   | Description |
  |---------------------|------------------------|-------------|
  | `OP_WITHDRAW_FP`      | `Opcode`                 | `0xecb4d6bf` |
  | `receiver`            | `Address`                | Address receiving withdrawn assets. |
  | `minWithdraw`         | `Coins`                  | Minimum asset amount to receive, else refund. |
  | `withdrawOptions` | `Cell<WithdrawOptions>?`  | Optional parameters (e.g., price data). |
  | `callbacks`           | `Callbacks`              | Success/failure callbacks. |

**Provide Quote and Take Quote**

![quote](./assets/quote.png)


- **Description**: Fetches current asset-to-share conversion information from the vault.
- **Requirements**:
  - MUST verify `in.valueCoins` covers gas for Provide Quote.
  - MUST send `OP_TAKE_QUOTE` to `receiver`.
  - If `receiver` is address none, SHOULD set `receiver` to `initiator`.
  - MAY emit `TOPIC_QUOTED` event.

- **Messages**:
  - **`QuoteOptions`**

    | Field        | Type                 | Description |
    |--------------|----------------------|-------------|
    | `vaultOptions` | `Cell<VaultOptions>?` | Reference to common options shared across vault operations (deposit, withdraw, query quote). |
    | *(user-defined)* | `any` | Quote-specific parameters defined by the developer. |

  - **`OP_PROVIDE_QUOTE`**:

    | Field               | Type      | Description |
    |---------------------|-----------|-------------|
    | `OP_PROVIDE_QUOTE`    | `Opcode`    | `0xc643cc91` |
    | `queryId`             | `QueryId`   | Unique query identifier. |
    | `quoteAsset`             | `Cell<Asset>?`   | For vaults that support multiple assets, quoteAsset is used as the basis for calculating the exchange rate. If this field is null, the exchange rate will be calculated using the baseAsset. |
    | `receiver`            | `Address`   | Address receiving `OP_TAKE_QUOTE`. |
    | `quoteOptions` | `Cell<QuoteOptions>?`     | Additional data for asset/share calculations. |
    | `forwardPayload`      | `Cell`      | Initiator-defined payload for further `receiver` operations. This can include custom fields such as validUntil |

  - **`OP_TAKE_QUOTE`**:

    | Field          | Type    | Description |
    |----------------|---------|-------------|
    | `OP_TAKE_QUOTE`  | `Opcode`  | `0x68ec31ea` |
    | `queryId`        | `QueryId` | Unique query identifier. |
    | `initiator`      | `Address` | Address sending `OP_PROVIDE_QUOTE`. |
    | `quoteAsset`             | `Cell<Asset>`   | Base asset used for calculating the exchange rate. |
    | `totalSupply`    | `Coins`   | Total vault shares. |
    | `totalAssets`    | `Coins`   | Total underlying assets. |
    | `timestamp`      | `Timestamp`  | Timestamp of `totalSupply` and `totalAssets` calculation. |
    | `forwardPayload` | `Cell?`   | Initiator-defined payload. |

#### Functions and Get-Methods
TEP-4626 vaults MUST implement the following functions for querying vault state and conversion rates. Each function has two forms:
- **Internal Function**: Core logic for calculations, used within vault operations (e.g., deposit/withdraw). Parameters MUST include resolved configs (e.g., `DepositConfig` or `VaultConfig`), which are parsed and validated structures derived from user options.
- **Get-Method**: Exposed query method (e.g., `getConvertToShares`) that wraps the internal function. It accepts user-provided options (e.g., `DepositOptions` or `VaultOptions` as Cell), resolves them into the corresponding configs, and then passes the resolved configs to the internal function. This method is callable off-chain without gas costs.

- **`totalAssets`**
  - **Description**: 
    - Returns the total underlying assets managed by the vault. 
    - For multi-asset vaults, calculations may use a quote asset specified in the config for exchange rate conversions; if not specified, the base asset is used.
  - **Requirements**:
    - SHOULD include compounding from yield.
    - MUST include fees charged against assets.
    - For multi-asset vaults, SHOULD use the quote asset for normalization if specified; otherwise, use base asset.
  - **Input**:
    | Field         | Type           | Description |
    |---------------|----------------|-------------|
    | `vaultConfig` | `VaultConfig?` | Resolved internal config (e.g., for exchange rates in multi-asset scenarios). |

    *Note: For the get-method (`getTotalAssets`), replace `vaultConfig` with `vaultOptionsCell: Cell<VaultOptions>?`. The get-method should resolve `vaultOptionsCell` into `vaultConfig` before calling the internal function.*
  - **Output**:
    | Field                | Type    | Description                                      |
    |----------------------|---------|--------------------------------------------------|
    | `totalManagedAssets` | `Coins` | Total managed assets (normalized if quote asset specified in multi-asset vaults). |

- **`convertToShares`**
  - **Description**: 
    - Estimates the number of shares that would be minted for a given asset amount in an ideal scenario.
    - For multi-asset vaults, calculations may use a quote asset specified in the config for exchange rate conversions; if not specified, the base asset is used.
  - **Requirements**:
    - MUST NOT include fees charged against assets.
    - MUST NOT vary by caller.
    - MUST NOT reflect slippage or on-chain conditions.
    - MUST NOT revert unless due to integer overflow from unreasonably large input.
    - MUST round down to 0.
    - MAY NOT reflect per-user price-per-share, but SHOULD reflect the average user’s price-per-share.
    - For multi-asset vaults, SHOULD handle conversions via config if needed.
  - **Input**:
    | Field           | Type              | Description |
    |-----------------|-------------------|-------------|
    | `depositAmount` | `Coins`           | Asset amount to convert. |
    | `depositConfig` | `DepositConfig?`  | Resolved internal config (e.g., for exchange rates in multi-asset scenarios). |
    | `rounding`      | `RoundingType`    | Rounding mode (default: ROUND_DOWN). |

    *Note: For the get-method (`getConvertToShares`), replace `depositConfig` with `depositOptionsCell: Cell<DepositOptions>?`. The get-method should resolve `depositOptionsCell` into `depositConfig` before calling the internal function.*
  - **Output**:
    | Field    | Type    | Description |
    |----------|---------|-------------|
    | `shares` | `Coins` | Estimated shares. |

- **`convertToAssets`**
  - **Description**: 
    - Estimates the amount of assets that would be received for a given share amount in an ideal scenario.
    - For multi-asset vaults, calculations may use a quote asset specified in the config for exchange rate conversions; if not specified, the base asset is used.
  - **Requirements**:
    - MUST NOT include fees charged against assets.
    - MUST NOT vary by caller.
    - MUST NOT reflect slippage or on-chain conditions.
    - MUST NOT revert unless due to integer overflow from unreasonably large input.
    - MUST round down to 0.
    - MAY NOT reflect per-user price-per-share, but SHOULD reflect the average user’s price-per-share.
    - For multi-asset vaults, SHOULD handle conversions via config if needed.
  - **Input**:
    | Field            | Type               | Description |
    |------------------|--------------------|-------------|
    | `shares`         | `Coins`            | Share amount to convert. |
    | `withdrawConfig` | `WithdrawConfig?`  | Resolved internal config (e.g., for exchange rates in multi-asset scenarios). |
    | `rounding`       | `RoundingType`     | Rounding mode (default: ROUND_DOWN). |

    *Note: For the get-method (`getConvertToAssets`), replace `withdrawConfig` with `withdrawOptionsCell: Cell<WithdrawOptions>?`. The get-method should resolve `withdrawOptionsCell` into `withdrawConfig` before calling the internal function.*
  - **Output**:
    | Field    | Type    | Description |
    |----------|---------|-------------|
    | `assets` | `Coins` | Estimated assets. |

- **`maxDeposit`**
  - **Description**: 
    - Returns the maximum underlying asset amount that can be deposited into the vault.
    - For multi-asset vaults, the specific asset to query can be specified in the config; if not, the base asset is used.
  - **Requirements**:
    - MUST return the maximum deposit amount that won’t revert, underestimating if necessary.
    - Assumes the user has unlimited assets.
    - MUST consider global or asset-specific constraints (e.g., return 0 if deposits are disabled).
    - MAY return `531691198313966349161522824112137833` (maximum `Coins` value) if no deposit limits exist.
    - For multi-asset vaults, SHOULD handle limits via config if needed.
  - **Input**:
    | Field           | Type              | Description |
    |-----------------|-------------------|-------------|
    | `depositConfig` | `DepositConfig?`  | Resolved internal config (e.g., for asset-specific limits in multi-asset scenarios). |

    *Note: For the get-method (`getMaxDeposit`), replace `depositConfig` with `depositOptionsCell: Cell<DepositOptions>?`. The get-method should resolve `depositOptionsCell` into `depositConfig` before calling the internal function.*
  - **Output**:
    | Field              | Type    | Description |
    |--------------------|---------|-------------|
    | `maxDepositAmount` | `Coins` | Maximum deposit amount. |

- **`previewDeposit`**
  - **Description**: 
    - Simulates the deposit outcome based on the current block state (callable off-chain via get-method).
    - For multi-asset vaults, the specific asset to query can be specified in the config; if not, the base asset is used.
  - **Requirements**:
    - MUST return a value as close as possible to (but not exceeding) the shares minted in an actual deposit.
    - MUST NOT consider deposit limits (e.g., `maxDeposit`); assumes deposit succeeds.
    - MUST include deposit fees, ensuring integrators are aware of them.
    - MUST NOT revert due to vault-specific global limits but MAY revert for other conditions that would cause deposit to revert.
    - Differences between `convertToShares` and `previewDeposit` indicate slippage or other losses.
    - For multi-asset vaults, SHOULD handle previews via config if needed.
  - **Input**:
    | Field           | Type              | Description |
    |-----------------|-------------------|-------------|
    | `depositAmount` | `Coins`           | Asset amount to deposit. |
    | `depositConfig` | `DepositConfig?`  | Resolved internal config (e.g., for exchange rates or fees in multi-asset scenarios). |

    *Note: For the get-method (`getPreviewDeposit`), replace `depositConfig` with `depositOptionsCell: Cell<DepositOptions>?`. The get-method should resolve `depositOptionsCell` into `depositConfig` before calling the internal function.*
  - **Output**:
    | Field    | Type    | Description |
    |----------|---------|-------------|
    | `shares` | `Coins` | Estimated shares minted. |

- **`maxWithdraw`**
  - **Description**: 
    - Returns the maximum share amount that can be withdrawn from the vault.
    - For multi-asset vaults, the specific asset to query can be specified in the config; if not, the base asset is used.
  - **Requirements**:
    - MUST return the maximum shares that can be withdrawn without reverting, underestimating if necessary.
    - MUST consider global constraints (e.g., return 0 if withdrawals are disabled).
    - MAY return `531691198313966349161522824112137833` (maximum `Coins` value) if no withdraw limits exist.
    - For multi-asset vaults, SHOULD handle limits via config if needed.
  - **Input**:
    | Field            | Type               | Description |
    |------------------|--------------------|-------------|
    | `withdrawConfig` | `WithdrawConfig?`  | Resolved internal config (e.g., for asset-specific limits in multi-asset scenarios). |

    *Note: For the get-method (`getMaxWithdraw`), replace `withdrawConfig` with `withdrawOptionsCell: Cell<WithdrawOptions>?`. The get-method should resolve `withdrawOptionsCell` into `withdrawConfig` before calling the internal function.*
  - **Output**:
    | Field       | Type    | Description |
    |-------------|---------|-------------|
    | `maxShares` | `Coins` | Maximum withdrawable shares. |

- **`previewWithdraw`**
  - **Description**: 
    - Simulates the withdrawal outcome based on the current block state (callable off-chain via get-method).
    - For multi-asset vaults, the specific asset to query can be specified in the config; if not, the base asset is used.
  - **Requirements**:
    - MUST return a value as close as possible to (but not exceeding) the assets withdrawn in an actual withdrawal.
    - MUST NOT consider withdrawal limits (e.g., `maxWithdraw`); assumes withdrawal succeeds.
    - MUST include withdrawal fees, ensuring integrators are aware of them.
    - MUST NOT revert due to vault-specific global limits but MAY revert for other conditions that would cause withdrawal to revert.
    - Differences between `convertToAssets` and `previewWithdraw` indicate slippage or other losses.
    - For multi-asset vaults, SHOULD handle previews via config if needed.
  - **Input**:
    | Field            | Type               | Description |
    |------------------|--------------------|-------------|
    | `shares`         | `Coins`            | Share amount to withdraw. |
    | `withdrawConfig` | `WithdrawConfig?`  | Resolved internal config (e.g., for exchange rates or fees in multi-asset scenarios). |

    *Note: For the get-method (`getPreviewWithdraw`), replace `withdrawConfig` with `withdrawOptionsCell: Cell<WithdrawOptions>?`. The get-method should resolve `withdrawOptionsCell` into `withdrawConfig` before calling the internal function.*
  - **Output**:
    | Field    | Type    | Description |
    |----------|---------|-------------|
    | `assets` | `Coins` | Estimated assets withdrawn.

- **`previewTonDepositFee`**
  - **Description**: Returns the gas fee required for depositing TON to the vault.
  - **Requirements**:
    - MUST exclude forward and storage fees.
    - MUST exclude fees for subsequent contract interactions (e.g., Jetton Transfer).
    - MUST NOT revert.
    - SHOULD return a conservative (upper-bound) estimate to account for network variability.
  - **Input**: None
  - **Output**:

    | Field            | Type  | Description |
    |------------------|-------|-------------|
    | `tonDepositGasFee` | `Coins` | Gas fee for TON deposit. |

- **`previewJettonDepositFee`**
  - **Description**: Returns the gas fee required for depositing Jetton to the vault.
  - **Requirements**:
    - MUST exclude forward and storage fees.
    - MUST exclude fees for subsequent contract interactions (e.g., Jetton Transfer).
    - MUST NOT revert.
    - SHOULD return a conservative estimate.
  - **Input**: None
  - **Output**:

    | Field                | Type  | Description |
    |----------------------|-------|-------------|
    | `jettonDepositGasFee`  | `Coins` | Gas fee for Jetton deposit. |

- **`previewWithdrawFee`**
  - **Description**: Returns the gas fee required for withdrawing from the vault.
  - **Requirements**:
    - MUST exclude forward and storage fees.
    - MUST exclude fees for subsequent contract interactions (e.g., Jetton Transfer).
    - MUST NOT revert.
    - SHOULD return a conservative estimate.
  - **Input**: None
  - **Output**:

    | Field           | Type  | Description |
    |-----------------|-------|-------------|
    | `withdrawGasFee`  | `Coins` | Gas fee for withdrawal. |

- **`previewProvideQuoteFee`**
  - **Description**: Returns the gas fee required for querying `totalAssets` and `totalSupply`.
  - **Requirements**:
    - MUST exclude forward and storage fees.
    - MUST exclude fees for subsequent contract interactions (e.g., Jetton Transfer).
    - MUST NOT revert.
    - SHOULD return a conservative estimate.
  - **Input**: None
  - **Output**:

    | Field            | Type  | Description |
    |------------------|-------|-------------|
    | `provideQuoteFee`  | `Coins` | Gas fee for quote query. |

#### Events

- **`Deposited`**
  - **Description**: Emitted when initiator exchanges `depositAmount` for shares, transferring them to receiver.
  - **Message**:

    | Field               | Type                        | Description |
    |---------------------|-----------------------------|-------------|
    | `TOPIC_DEPOSITED`     | `Opcode`                      | `0x11475d67`  |
    | `initiator`           | `Address`                     | Address initiating the deposit. |
    | `receiver`            | `Address`                     | Address receiving shares. |
    | `depositAmount`       | `Coins`                       | Deposited asset amount. |
    | `shares`              | `Coins`                       | Minted shares. |
    | `optionalDepositLogs` | `Cell<OptionalDepositLogs>?`  | Custom deposit logs. |
    | `timestamp`           | `Timestamp`                      | Event timestamp for off-chain indexing. |

- **`Withdrawn`**
  - **Description**: Emitted when initiator exchanges shares for assets, transferring them to receiver.
  - **Message**:

    | Field                | Type                         | Description |
    |----------------------|------------------------------|-------------|
    | `TOPIC_WITHDRAWN`      | `Opcode`                       | `0xedfb416d`  |
    | `initiator`            | `Address`                      | Address initiating the withdrawal. |
    | `receiver`             | `Address`                      | Address receiving assets. |
    | `withdrawAmount`       | `Coins`                        | Withdrawn asset amount. |
    | `burnedShares`         | `Coins`                        | Burned shares. |
    | `optionalWithdrawLogs` | `Cell<OptionalWithdrawLogs>?`  | Custom withdrawal logs. |
    | `timestamp`            | `Timestamp`                       | Event timestamp for off-chain indexing. |

- **`Quoted`**
  - **Description**: Emitted when the vault provides a quote for asset-to-share conversion, including total supply and assets at the time of calculation.
  - **Message**:

    | Field          | Type           | Description |
    |----------------|----------------|-------------|
    | `TOPIC_QUOTED`  | `Opcode`       | `0xb7bfa697`  |
    | `quoteAsset`    | `Cell<Asset>`  | `quoteAsset` is used as the basis for calculating the exchange rate. |
    | `initiator`     | `Address`      | Address initiating the quote request. |
    | `receiver`      | `Address`      | Address receiving the quote response. |
    | `totalSupply`   | `Coins`        | Total vault shares at the time of quote. |
    | `totalAssets`   | `Coins`        | Total underlying assets at the time of quote. |
    | `timestamp`     | `Timestamp`       | Event timestamp for off-chain indexing. |

## Drawbacks

While TEP-4626 provides a standardized interface for tokenized vaults on TON, it has several limitations and potential risks that developers should consider:

- **Security Risks in Notifications**: The `VaultNotification` mechanism enhances communication between protocols for handling success or failure outcomes. However, if the vault's administrative privileges (e.g., via `adminAddress`) are compromised, an attacker could upgrade the contract and send forged messages, potentially deceiving integrated protocols. This underscores the need for robust access controls and verification in vault implementations.
  
- **Lack of Per-Address Limits**: The standard does not include built-in restrictions on deposit or withdrawal amounts for individual addresses. This could expose vaults to risks like flash loan exploits or whale manipulations, requiring developers to implement custom limits via `DepositOptions` or `WithdrawOptions` if needed.
  
- **Timeliness Issues in Quotes**: The `provideQuote` and `takeQuote` mechanisms may suffer from delays inherent to TON's asynchronous messaging architecture. Quotes are based on snapshot values of `totalSupply` and `totalAssets`, but by the time the quote is received, the vault's state could have changed due to concurrent operations, network congestion, or cross-shard interactions. This could lead to unexpected slippage or failed operations, necessitating off-chain monitoring or time-bound validity checks in integrations.

These drawbacks will be further explored in the Rationale and Alternatives section, where we explain potential solutions and design choices to address them.

## Rationale and Alternatives

The vault interface follows ERC-4626 design principles while adapting to the unique characteristics of the TON blockchain. Key decisions, their rationale, and considered alternatives are outlined below:

### Asynchronous Notifications and Security Risks
**Rationale**: TON is an asynchronous system, making rollbacks or inter-protocol interactions challenging. Without standards, integrations become difficult and prone to vulnerabilities, such as those seen in TON from improper use of success/failure payloads. Thus, a notification system is essential for vaults, allowing interacting contracts to perform next steps based on outcomes. However, this introduces risks if the vault's admin is compromised, enabling forged messages via contract upgrades.  
**Alternatives**: To mitigate, three approaches are recommended: (1) Use multisig for admin; (2) Implement timelocks for upgrades, with third-party guardians independent of the admin able to cancel; (3) Disable code upgrades entirely. Many TON DeFi contracts allow upgrades, but combining (1) and (2) effectively limits attacks.

### Multi-Asset Support
**Rationale**: Unlike ERC-4626's single-asset model, TEP-4626 supports multi-assets for two reasons: (1) Top Ethereum vaults (e.g., Veda Labs' Boring Vault) feature multi-asset functionality; (2) User experience benefits, e.g., a stablecoin vault accepting USDT/USDe/USDC avoids extra swaps, reducing uncertainty. Vaults can handle conversions post-deposit via oracles, DEX, OTC, or cross-chain liquidity for better UX.  
**Alternatives**: A single-asset-only design was considered for simplicity, but it limits innovation. Full dict unification for all vaults (even single-asset) was evaluated for code reuse, but rejected due to gas overhead; the dual approach optimizes common cases.

### Off-Chain Data Integration via VaultOptions
**Rationale**: TON lacks on-chain price fetching like Ethereum, so off-chain data (e.g., prices) is carried via messages. VaultOptions allows passing such data, validated into VaultConfig for use.

### Omission of Extra Currency Support
**Rationale**: TON supports Extra Currency, but its usage is not widespread, with no DeFi protocols adopting it yet. Thus, the current design excludes it.  
**Alternatives**: Immediate inclusion was considered, but deferred due to ecosystem immaturity; future versions could add it as adoption grows (see Future Possibilities).

### Asset-Based Limits Instead of Per-Address
**Rationale**: ERC-4626 limits maxDeposit/maxWithdraw per address, but TEP-4626 uses asset-based checks. On TON, querying initiator's shares on-chain is difficult without dicts (inefficient) or sub-contracts/Jetton wallets (complex).  
**Alternatives**: Per-user dict tracking was evaluated, but adds gas costs. Sub-contracts increase fragmentation; asset-based limits provide adequate protection without overhead.

### Omission of Mint/Redeem Functions
**Rationale**: ERC-4626's mint (specify shares, vault pulls assets) and redeem (specify assets, vault pulls shares) require wallet plugging, uncommon on TON. Omitting them aligns with user habits of direct transfers, reducing cognitive load.  
**Alternatives**: Implementing them was considered, but skipped due to low adoption and added complexity/async risks; direct transfers fit TON norms better.

### Provide/Take Quote Mechanism and Timeliness
**Rationale**: Fetching exchange rates faces Jetton balance query issues—rates may change by response time. Adding timestamps to OP_TAKE_QUOTE lets receivers validate freshness.  
**Alternatives**: Pure off-chain quotes reduce on-chain composability. Omitting timestamps risks stale data; timestamps enable time-bound checks.

### Slippage Protection via minShares/minWithdraw
**Rationale**: Adding minShares/minWithdraw checks in deposit/withdraw refunds on failure, protecting against rate volatility for better UX.

### Mitigation of Donation Attacks
**Rationale**: No donation attacks per design, as transfers require valid payloads to update totalAssets. Direct transfers without payloads are ignored. Issues arise only if rates are off-chain calculated from balances—in such cases, vaults should avoid relying on direct balance checks to prevent manipulation.

### Gas Estimation for Developer Experience
**Rationale**: TON interactions often fail due to insufficient TON despite docs. Preview fees (e.g., previewDeposit) let developers estimate costs, reducing errors and improving DX.

These design choices address the limitations outlined in the Drawbacks section, with unresolved questions and future extensions explored in subsequent sections.

## Prior Art

- `ERC-4626`: Tokenized Vault Standard for Ethereum, providing the foundational design for deposit, withdrawal, and conversion functions ([EIP-4626](https://eips.ethereum.org/EIPS/eip-4626)).
- `TEP-74`: Jetton Standard for TON, defining fungible token mechanics ([TEP-74](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)).
- `TEP-64`: Token Data Standard for Jetton metadata ([TEP-64](https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md)).

## Unresolved Questions

This section highlights open questions that remain unresolved in the current draft. These are areas for potential community feedback or further research:

- **Admin Security Risks**: Even with multisig admins, timelock upgrades, and third-party monitoring to prevent illicit contract updates, there remains inherent risk in upgradable vaults. Beyond fully disabling code upgrades, no 100% foolproof method exists to eliminate compromise risks, particularly in a dynamic DeFi environment. How can protocols further harden against this without sacrificing maintainability? This ties into Drawbacks' notification security concerns and invites exploration in implementations.

These questions do not affect the core standard but provide opportunities for refinement based on real-world usage.

## Future Possibilities

TEP-4626 establishes a solid foundation for TON vaults, with potential for evolution as the ecosystem advances. The following extensions build on the current design:

- **Extra Currency Integration**: Once Extra Currency adoption matures in TON DeFi, it could be added to the `Asset` encoding, enabling more diverse multi-asset vaults and broader token support.
  
- **Mint and Redeem Functions via Wallet Plugging**: If wallet plugging becomes more widespread on TON, future versions could incorporate ERC-4626-style mint/redeem operations, enhancing flexibility for direct asset pulls while aligning with evolving user habits.
  
- **Gasless Vault Operations**: To improve UX, extensions could support gasless interactions, reducing barriers for deposits/withdrawals without compromising security.

These possibilities depend on TON's technical progress and community input. Contributions via discussions or PRs are encouraged to develop them further.

## Backwards Compatibility

`TEP-4626` extends `TEP-74` Jetton, ensuring compatibility with existing Jetton contracts. However, new messages and get-methods require updates to integrating protocols.



