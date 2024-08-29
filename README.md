# Holyheld SDK

Holyheld SDK provides methods to on- and off-ramp crypto to and from Holyheld account in Typescript/Javascript environment. By using provided functions, the process is split in only a few steps, allowing you a full control over customer flow and UI.

[![npm](https://img.shields.io/npm/v/@holyheld/sdk?labelColor=1F1F1F&color=41CA28)](https://www.npmjs.com/package/@holyheld/sdk)
![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-41CA28?labelColor=1F1F1F)

## Quick navigation:

- [Installation](#installation)
- [Initialization](#initialization)
- [Off-ramp flow](#off-ramp-flow)
- [On-ramp flow](#on-ramp-flow)
- [Additional methods](#additional-methods)
- [Working with different Web3 providers](#working-with-different-web3-providers)
- [Utilities](#utilities)
- [Error handling](#error-handling)
- [Logging](#logging)
- [Examples](#examples)
- [Testing](#testing)

## 🔔 Web3 Provider note

> By default, a [viem](https://github.com/wagmi-dev/viem) provider is used for EVM-compatible JSON-RPC interaction, but [Web3.js](https://github.com/web3/web3.js) and [ethers.js](https://github.com/ethers-io/ethers.js) are also supported, please see [examples](#working-with-different-web3-providers).

# Installation

Using npm:

```bash
$ npm install @holyheld/sdk
```

Using yarn:

```bash
$ yarn add @holyheld/sdk
```

# Initialization

```js
import HolyheldSDK from '@holyheld/sdk';

(async () => {
  const holyheldSDK = new HolyheldSDK({
    apiKey: process.env.HOLYHELD_SDK_API_KEY,
  });
  await holyheldSDK.init();
})();
```

# Off-ramp Flow

To off-ramp to a Holyheld account the following steps should be completed:
1. Get settings and ensure that off-ramping is available using `getServerSettings` method.
2. Check that selected wallet or holytag can transact using methods: `validateAddress` for a wallet or `getTagInfoForTopUp` for a $holytag.
3. Provide two parameters: token and amount.
4. Get binary data to pass as swap parameters using `convertTokenToEUR` or `convertEURToToken` methods.
5. Call the `topup` method to execute the transaction.
> 🔔 If multiple wallet interactions are required (signing allowance and executing a transaction, or permit signing and executing a transaction), they will be processed automatically.
6. Wait for the transaction hash of the operation to be received.

Here are the functions that are available for you to use.

## `getServerSettings` Get settings:

This method gets current state/settings for interacting with the service. Please always use this method to check:
- if the feature is available;
- the minimum and maximum allowed amounts to off-ramp.

> 🔔 Please note, that financial values are provided and consumed as strings to avoid floating point conversion problems.

```js
(async () => {
  const data = await holyheldSDK.getServerSettings();
})();
```

Types:

```typescript
type Response = {
  external: {
    // indicates if the sending feature is available at the moment
    isTopupEnabled: boolean;
    // maximum amount (equivalent in EUR) that is allowed to be processed
    maxTopUpAmountInEUR: string; // example: '1000'
    // minimum amount (equivalent in EUR) that is allowed to be processed
    minTopUpAmountInEUR: string; // example: '5'
  };
  common: {
    // fee (in percent) that is deducted when making an off-ramping operation on mainnet
    topUpFeePercent: string; // example: '0.75'
  };
}
```

## `validateAddress` Get wallet information:

User wallet address is a unique identifier which can have account, card and a $holytag bound to it. It is alphanumeric string.

> 🔔 Please note that a valid wallet address is 42 strings long and begins with `0x` prefix.

> 🔔 Please note that this method does not support ENS domains.


```js
(async () => {
  // a wallet address could be pre-set or have to be input by user, depends on the application
  const data = await holyheldSDK.validateAddress('0x000000000000000000000000000000000000dEaD');
})();
```

Types:

```typescript
type Response = {
  isTopupAllowed: boolean;
  isOnRampAllowed: boolean;
}
```

## `getTagInfoForTopUp` Get tag information:

$Holytag is a unique identifier which can have account, card and multiple Ethereum addresses bound to it. It is alphanumeric string with a few special characters allowed.

> 🔔 Please note that a valid HH tag could be as short as one character in length.

When displaying $holytag usually is prepended with a `$` prefix, for example: $JohnSmith holytag is `JohnSmith` or $PEPE holytag `PEPE`, etc.

Tags are stored case-sensitive for display, but not case-sensitive for search, and are not allowed to have multiple case variants registered, meaning if there is a tag `$ToTheMoon` registered, there couldn't be tag `$toTHEmoon` created afterwards.

### 🔔 Test $holytag

> You can use `TESTSDK` as a test $holytag. All transactions to this $holytag will NOT trigger an actual fiat transaction, but will return a fully valid response. There is no minimum amount set for the test $holytag. Funds can be retrieved back. This test $holytag works across all supported networks an tokens.

```js
(async () => {
  // a tag name could be pre-set or have to be input by user, depends on the application
  const data = await holyheldSDK.offRamp.getTagInfoForTopUp('TESTSDK');
})();
```

Types:

```typescript
type Response = {
  // if the tag exists and active
  found: boolean;
  // tag name (with writing preserving capital case, as registered)
  tag?: string; // example: 'TESTSDK'
  // if created, a link to avatar image (tag can have avatar picture set)
  avatarSrc?: string; // example: 'https://holyheld.com/static/avatar.png'
}
```

## `getWalletBalances` Get wallet balances:

You can use `getWalletBalances` method to retrieve all tokens on the connected user wallet address. Holyheld natively supports 14 Networks. The full list of supported networks is [here](https://holyheld.com/faq/frequently-asked-questions/supported-networks).

```js
(async () => {
  const data = await holyheldSDK.getWalletBalances(
    '0x...', // user wallet address
  );
})();
```

Types:

```typescript
import { Network } from '@holyheld/sdk';

type WalletToken = {
  // name of the token
  name: string; // example: 'Ether'
  // smart contract address of the token
  address: string; // example: '0x...'
  // token symbol
  symbol: string; // example: 'ETH'
  // token decimal digits (as in ERC20 implementation)
  decimals: number; // example: 18
  // network (blockchain), on which this token resides
  network: Network;
  // logo (picture) for the token
  iconURL: string; // example: 'https://holyheld.com/static/tokens/eth/eth.png'
  // current estimated price (in USD)
  priceUSD: string; // example: '1796.55'
  // amount of token in the user's wallet
  balance: string; // example: '0.0000099999999'
  // if the token supports permit signatures
  hasPermit: boolean;
  // type of permit signature, 'erc2612' is expected
  permitType?: string;
  // permit version (currently, if permit supported, '1' is expected)
  permitVersion?: string; // example: '1'
  // token price converted from USD valuation to EUR
  priceInEURForTopUp: string; // example: '1726.53'
};

type Response = {
  tokens: WalletToken[];
}
```

## `convertTokenToEUR` Convert token to EUR:

This method is used to estimate a token value in EUR to proceed with the off-ramping. `convertTokenToEUR` method can also be used in some scenarios/apps where token to be sent is pre-set and not selectable.

This method also returns `transferData` — a hexadecimal string which can contain token-specific transfer, unwrap or swap data that is passed in off-ramping transaction.

```js
import { Network } from '@holyheld/sdk';

(async () => {
  const data = await holyheldSDK.offRamp.convertTokenToEUR(
    '0x...', // token address
    6, // token decimals
    '9.99', // token amount
    Network.ethereum, // token network
  );
})();
```

Types:

```typescript
import type { TransferData } from '@holyheld/sdk';

type Response = {
  // amount of token that was passed to query
  tokenAmount: string; // example: '1.99'
  // EUR valuation of the token amount provided
  EURAmount: string; // example: '314.25'
  // data to be passed in sending transaction for this specific token (and amount)
  transferData?: TransferData;
}
```

## `convertEURToToken` Convert EUR to token:

`convertEURToToken` method returns a calculated token amount to match provided (expected) EUR amount.

This method also returns `transferData`, that is hexadecimal string which could contain token-specific transfer, unwrap or swap data that is passed in sending to tag transaction.

```js
import { Network } from '@holyheld/sdk';

(async () => {
  const data = await holyheldSDK.offRamp.convertEURToToken(
    '0x...', // token address
    6, // token decimals
    '999.99', // EUR amount
    Network.ethereum, // token network
  );
})();
```

Types:

```typescript
import type { TransferData } from '@holyheld/sdk';

type Response = {
  // amount (in EUR) that was passed to query
  EURAmount: string; // example: '30.00'
  // token amount to match expected valuation
  tokenAmount: string; // example: '4.18'
  // data to be passed in sending transaction for this specific token (and amount)
  transferData?: TransferData;
}
```

## Off-ramp:

This is the 'main' method to call that executes off-ramping to the user card. Parameter values should be retrieved using methods described above, such as `transferData` matching token and token amount provided.

> 🚨 Some wallets like Metamask are single-network handled. It means that while Holyheld can return/accept transaction on any supported network, user **must** switch to the correct network in the wallet, in order for the transaction to be processed.

```js
import { Network } from '@holyheld/sdk';
import * as chains from 'viem/chains';
import { createPublicClient, createWalletClient, custom, http } from 'viem';

const provider; // current provider in your app (see examples below)
const transferData; // transfer data from conversion methods or undefined
const callbackConfig; // callbacks
const chainId; // token chain id

// get chain entity from viem
const chain = Object.values(chains).find((item) => item.id === chainId);

// create viem public client
// https://viem.sh/docs/clients/public.html
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

// wrap your provider in viem wallet client
// https://viem.sh/docs/clients/wallet.html
const walletClient = createWalletClient({
  chain,
  transport: custom(provider), // current provider in your app (see examples below)
  account: '0x...', // wallet address
});

(async () => {
  await holyheldSDK.offRamp.topup(
    publicClient,
    walletClient,
    '0x...', // wallet address
    '0x...', // token address
    Network.ethereum, // token network
    '5.25', // token amount
    transferData, // if was provided by 'convertTokenToEUR' and/or 'convertEURToToken'
    'TESTSDK', // funds recipient tag
    true, // true if connected wallet supportsSignTypedDataV4 (for more human friendly signature request)
    callbackConfig, // callbacks (see below)
  );
})();
```

Types:

```typescript
enum TopUpStep {
  Confirming = 'confirming', // user is confirming action on review screen
  Approving = 'approving', // a request was sent to wallet for approval or permit signature
  Sending = 'sending', // a request was sent to wallet for executing sending funds to a tag
}

interface TopUpCallbackConfig {
  onHashGenerate?: (hash: string) => void;
  onStepChange?: (step: TopUpStep) => void;
}
```
# On-ramp Flow

To on-ramp from a Holyheld account the following steps should be completed:
1. Get settings and ensure that on-ramping is available using `getServerSettings` method.
2. Check that selected wallet can transact using `validateAddress` method.
3. Provide two parameters: token and amount in EUR.
4. Optionally. Get binary data to pass as swap parameters using `convertEURToToken` or `convertTokenToEUR` methods.
5. Call the `requestOnRamp` method to execute the transaction.
> 🔔 User will need to confirm the on-ramp request in their Holyheld app
6. Wait for the callback response of the operation result using `watchRequestId`.

Here are the functions that are available for you to use.

## `getServerSettings` Get settings:

This method gets current state/settings for interacting with the service. Please always use this method to check:
- if the feature is available;
- the minimum and maximum allowed amounts to on-ramp.

> 🔔 Please note, that financial values are provided and consumed as strings to avoid floating point conversion problems.

```js
(async () => {
  const data = await holyheldSDK.getServerSettings();
})();
```

Types:

```typescript
type Response = {
  external: {
    // indicates if the sending feature is available at the moment
    isTopupEnabled: boolean;
    // maximum amount (equivalent in EUR) that is allowed to be processed
    maxTopUpAmountInEUR: string; // example: '1000'
    // minimum amount (equivalent in EUR) that is allowed to be processed
    minTopUpAmountInEUR: string; // example: '5'
  };
  common: {
    // fee (in percent) that is deducted when making an off-ramping operation on mainnet
    topUpFeePercent: string; // example: '0.75'
  };
}
```

## `validateAddress` Get wallet information:

User wallet address is a unique identifier which can have account, card and a $holytag bound to it. It is alphanumeric string.

> 🔔 Please note that a valid wallet address is 42 strings long and begins with `0x` prefix.

> 🔔 Please note that this method does not support ENS domains.


```js
(async () => {
  // a wallet address could be pre-set or have to be input by user, depends on the application
  const data = await holyheldSDK.validateAddress('0x000000000000000000000000000000000000dEaD');
})();
```

Types:

```typescript
type Response = {
  isTopupAllowed: boolean;
  isOnRampAllowed: boolean;
}
```

## `convertTokenToEUR` Convert token to EUR:

This method is used to estimate a token value in EUR to proceed with the on-ramping. `convertTokenToEUR` method can also be used in some scenarios/apps where token to be sent is pre-set and not selectable.

```js
(async () => {
  const result = await sdk.onRamp.convertTokenToEUR(
    token,
    '11.11' // native token amount
  );
  console.log('EUR amount is', result)
})();
```

## `convertEURToToken` Convert EUR to token:

`convertEURToToken` method returns a calculated token amount to match requested EUR amount.

```js
(async () => {
  const result = await sdk.onRamp.convertEURToToken(
    token,
    '11.11' // EUR amount
  );
  console.log('token amount is', result)
})();
```

## `requestOnRamp` Created on-ramp transaction request:

This is the 'main' method to call that executes on-ramping from a Holyheld account. Parameter values should be retrieved using methods described above, such as `transferData` matching token and token amount provided.

> 🚨 As per security requirements, user **must** approve or confirm the on-ramp request in their Holyheld mobile app within 3 minutes. If the user declines, or lets the confirmation expire -- the transaction will fail.

```js
(async () => {
  // you can locate token by address and network, or you can use a self token object
  const selectedToken = await sdk.getTokenByAddressAndNetwork('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', Network.ethereum)

  // wrap your provider in viem wallet client, see https://viem.sh/docs/clients/wallet.html
  const walletClient = createWalletClient({
    chain,
    transport: custom(provider), // current provider in your app (see examples in the Examples section)
    account: '0x...', // user wallet address
  });

  const data = await sdk.onRamp.requestOnRamp(
    walletClient,
    walletClient.account.address, // user wallet address
    selectedToken.address, // address of the token to arrive
    selectedToken.network, // network where tokens will arrive
    '1' // amount in EUR
  );
})();
```

Types:

```typescript
type RequestResult = {
  requestUid: string; // ID of the on-ramp request credted
  chainId: number; // ID of the network where tokens will arrive
  token: Token; // Address of the token to arrive
  amountEUR: string; // amount of EUR charged from the user
  amountToken: string; // native amount of tokens received
  feeEUR: string; // network gas fee charged from the total transaction amount
  beneficiaryAddress: Address; // user wallet address where tokens will arrive
}
```

After creating the on-ramp request, user will need to confirm it in their Holyheld app.

## `watchRequestId` Watch the on-ramp request by ID:
This method is used to await for the request outcome based on the user confirmation or rejection in the Holyheld app. There are only three possible outcomes of any request:
1. `true` if the request has been confirmed by the user and processed
2. `false` if the request has been declined by the user
3. An error if request was not processed, timed out, or HTTP request was not returned as `OK`

```js
(async () => {
  const result = await sdk.onRamp.watchRequestId(
    requestUid, // request ID from response for the requestOnRamp method
    timeout // optional
  );
})();
```

# Working with different Web3 providers

By default, a [viem](https://github.com/wagmi-dev/viem) provider is used for EVM-compatible JSON-RPC interaction. However, you can use Holyheld SDK with other providers like Ethers.js and Web3.js

## Wagmi

```js
import { getPublicClient, getWalletClient } from '@wagmi/core';

const chainId; // token chain id

(async () => {
  const publicClient = getPublicClient({ chainId });
  const walletClient = await getWalletClient({ chainId });
})();
```

## Ethers.js

```js
import { providers } from 'ethers';
import { createPublicClient, createWalletClient, custom, http } from 'viem';

const chain; // chain entity from viem

const provider = new providers.Web3Provider(window.ethereum);

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

const walletClient = createWalletClient({
  chain,
  transport: custom(provider.provider),
  account: '0x...', // wallet address
});
```

## Web3.js

```js
import Web3 from 'web3';
import { createPublicClient, createWalletClient, custom, http } from 'viem';

const chain; // chain entity from viem

const provider = new Web3(window.ethereum).currentProvider;

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

const walletClient = createWalletClient({
  chain,
  transport: custom(provider),
  account: '0x...', // wallet address
});
```

# Utilities

You can use the utilities to work with networks that the SDK supports:

```js
import { Network } from '@holyheld/sdk';

holyheldSDK.getAvailableNetworks(); // ['ethereum', 'polygon', ...]

holyheldSDK.getNetworkChainId(Network.ethereum); // 1

holyheldSDK.getNetwork(Network.ethereum); // NetworkInfo

holyheldSDK.getNetworkByChainId(1); // NetworkInfo

(async () => {
  // estimate transaction price
  const value = await holyheldSDK.offRamp.getTopUpEstimation(Network.ethereum); // '287499997500000' (in WEI)
})();
```

Types:

```typescript
type Token = {
  // smart contract address of the token
  address: string;
  // token decimal digits (as in ERC20 implementation)
  decimals: number;
  // token symbol
  symbol: string;
  // network (blockchain), on which this token resides
  network: Network;
  // name of the token
  name: string;
  // logo (picture) for the token
  iconURL: string;
};

type NetworkInfo = {
  network: Network;
  // name of the blockchain network
  name: string; // example: 'Polygon Mainnet'
  // chainId of the corresponding network
  chainId: number; // example: 137
  // block explorer URL of corresponding network
  explorerURL: string; // example: 'https://polygonscan.com'
  // block explorer name (e.g. to display user friendly link 'view on X')
  explorerName: string; // example: 'Polygonscan'
  // base asset (native/gas token) of the network
  baseAsset: Token;
  // RPC URLs array (array supported for redundancy purposes)
  rpcUrls: string[]; // example: ['https://polygon-rpc.com/'']
  // logo (picture) for the network, displayed near token logo to identify on which network the token is on
  iconURL: string; // example: 'data:image/png;base64,...'
  // name of the network to display
  displayedName: string; // example: 'Polygon'
  // id for sorting
  orderIdx: number; // example: 1
};
```

# Error handling

Some errors have the class `HolyheldSDKError`. The most helpful property of these errors is code. You can compare code with the values in the `HolyheldSDKErrorCode`.

```js
import { HolyheldSDKError, HolyheldSDKErrorCode } from '@holyheld/sdk';

const holyheldSDK = new HolyheldSDK({
  apiKey: process.env.HOLYHELD_SDK_API_KEY,
})

(async () => {
  try {
    await holyheldSDK.offRamp.topup(/* ... */);
  } catch (error) {
    if (
      error instanceof HolyheldSDKError &&
      (error.code === HolyheldSDKErrorCode.UserRejectedTransaction ||
        error.code === HolyheldSDKErrorCode.UserRejectedSignature)
    ) {
      // it's okay
    } else {
      // it's not okay
    }
  }
})();
```

Types:

```typescript
enum HolyheldSDKErrorCode {
  NotInitialized = 'HSDK_NI', // SDK is not initialized
  FailedInitialization = 'HSDK_FI', // cannot initialize SDK
  UnsupportedNetwork = 'HSDK_UN', // wallet active network is not supported by SDK
  InvalidTopUpAmount = 'HSDK_ITUA', // amount does not meet minimum or maximum allowed criteria
  UnexpectedWalletNetwork = 'HSDK_UWN', // wallet active network is different from the selected network
  UserRejectedSignature = 'HSDK_RS', // user rejected the signature
  UserRejectedTransaction = 'HSDK_RT', // user rejected transaction
  FailedSettings = 'HSDK_FS', // cannot get settings
  FailedTagInfo = 'HSDK_FTI', // cannot get $holytag info
  FailedAddressInfo = 'HSDK_FAI', // cannot get address info
  FailedWalletBalances = 'HSDK_FWB', // cannot get wallet balance
  FailedConversion = 'HSDK_FC', // cannot estimate EUR to TOKEN, or TOKEN to EUR
  FailedTopUp = 'HSDK_FTU', // cannot complete top up
  FailedCreateOnRampRequest = 'HSDK_FCOR', // cannot create on-ramp request
  FailedOnRampRequest = 'HSDK_FOR', // fail execute on-ramp request with reason (for example not enough balance)
  FailedWatchOnRampRequestTimeout = 'HSDK_FwORT', // watch request timeout
  FailedWatchOnRampRequest = 'HSDK_FWORR', // fail to watch request status
  FailedConvertOnRampAmount = 'HSDK_FCORA', //cannot convert (estimate) EUR to TOKEN, or TOKEN to EUR
}
```

# Logging

Logs are disabled by default. If you're debugging an application, set the `logger` option to `true`.

```js
new HolyheldSDK({
  apiKey: process.env.HOLYHELD_SDK_API_KEY,
  logger: true,
})
```

You may also set a custom logger:

```js
new HolyheldSDK({
  apiKey: process.env.HOLYHELD_SDK_API_KEY,
  logger: (level, message, data) => {
    console.log(level, message, data);
  },
})
```

Types:

```typescript
enum LogLevel {
  Warning = 'warning',
  Log = 'log',
  Info = 'info',
  Debug = 'debug',
}

type Logger = (
  // level of event to be logged
  level: LogLevel,
  // message to be logged
  message: string,
  // optional structured payload to be logged
  data?: { [key: string]: any },
) => void;
```

# Examples

Source code for several Web3 providers can be found in the examples directory, as well as deployed versions are available at:

* for ethers.js: https://sdk-example-ethers-v5.holyheld.com/
* for Web3.js: https://sdk-example-web3.holyheld.com/
* for viem: https://sdk-example-wagmi.holyheld.com/

These are minimal html/javascript applications to illustrate the flow described in the document above.

## Off-ramp example

A minimalistic version of the on-ramp SDK implementation can be found [here](https://holyheld.com/sdk/send).


## On-ramp example

A minimalistic version of the on-ramp SDK implementation can be found [here](https://sdk-example-wagmi-onramp.holyheld.com/).

# Testing

A test $holytag is defined to provide test capabilities: `$SDKTEST`. It can be used as recipient tag without minimum amount required on any supported network. It means there is no minimal amount restriction and that no real off-ramp transactions would take place, but the application, backend and smart contract interactions will be executed as they would during the regular flow.

It is advised to use the test tag `$SDKTEST` with small amounts of tokens (less than $0.1) on networks with low network gas fees (Arbitrum, Polygon, Avalanche, etc.) to avoid gas costs while performing the tests, ensuring correct live execution of the off-ramp.
