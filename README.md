# Holyheld SDK

Holyheld SDK provides methods to off-ramp crypto to Holyheld account via $holytag in Typescript/Javascript environment. By using provided functions, the process is split in only a few steps, allowing you a full control over customer flow and UI.

[![npm](https://img.shields.io/npm/v/@holyheld/sdk?labelColor=1F1F1F&color=41CA28)](https://www.npmjs.com/package/@holyheld/sdk)
![License: BSL 1.1](https://img.shields.io/badge/License-BSL--1.1-41CA28?labelColor=1F1F1F)

#### Quick navigation:

- [Installation](#installation)
- [Initialization](#initialization)
- [Off-ramp flow](#off-ramp-flow)
- [Working with different Web3 providers](#working-with-different-web3-providers)
- [Utilities](#utilities)
- [Error handling](#error-handling)
- [Logging](#logging)

#### 🔔 Web3 Provider note

> By default, a [viem](https://github.com/wagmi-dev/viem) provider is used for EVM-compatible JSON-RPC interaction, but [Web3.js](https://github.com/web3/web3.js) and [ethers.js](https://github.com/ethers-io/ethers.js) are also supported, please see [examples](#working-with-different-web3-providers).

## Installation

Using npm:

```bash
$ npm install @holyheld/sdk
```

Using yarn:

```bash
$ yarn add @holyheld/sdk
```

## Initialization

```js
import HolyheldSDK from '@holyheld/sdk';

const holyheldSDK = new HolyheldSDK({
  apiKey: process.env.HOLYHELD_SDK_API_KEY,
})
```

## Off-ramp Flow

To off-ramp to a Holyheld account the following steps should be completed:
1. Get settings and ensure that off-ramping is available using `getServerSettings` method.
2. Check that selected holytag can off-ramp using `getTagInfoForTopUp` method.
3. Provide two parameters: token and amount.
4. Get binary data to pass as swap parameters using `convertTokenToEUR` or `convertEURToToken` methods.
5. Call the `topup` method to execute the transaction.
> 🔔 If multiple wallet interactions are required (signing allowance and executing a transaction, or permit signing and executing a transaction), they will be processed automatically.
6. Wait for the transaction hash of the operation to be received.

Here are the functions that are available for you to use.

### Get settings:

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
    // fee (in percent) that is deducted when making an off-ramping operation
    topUpFeePercent: string; // example: '0.75'
  };
}
```

### Get tag information:

$Holytag is a unique identifier which can have account, card and multiple Ethereum addresses bound to it. It is alphanumeric string with a few special characters allowed.

> 🔔 Please note that a valid HH tag could be as short as one character in length.

When displaying $holytag usually is prepended with a `$` prefix, for example: $JohnSmith holytag is `JohnSmith` or $PEPE holytag `PEPE`, etc.

Tags are stored case-sensitive for display, but not case-sensitive for search, and are not allowed to have multiple case variants registered, meaning if there is a tag `$ToTheMoon` registered, there couldn't be tag `$toTHEmoon` created afterwards.

```js
(async () => {
  // a tag name could be pre-set or have to be input by user, depends on the application
  const data = await holyheldSDK.getTagInfoForTopUp(tagName);
})();
```

Types:

```typescript
type Response = {
  // if the tag exists and active
  found: boolean;
  // tag name (with writing preserving capital case, as registered)
  tag?: string; // example: 'ThisIsStefano'
  // if created, a link to avatar image (tag can have avatar picture set)
  avatarSrc?: string; // example: 'https://holyheld.com/static/avatar.png'
}
```

### Get wallet balances:

You can use `getWalletBalances` method to retrieve all tokens on the connected user wallet address. Holyheld natively supports 9 Networks. The full list of supported networks is [here](https://holyheld.com/faq/frequently-asked-questions/supported-networks).

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

### Convert token to EUR:

This method is used to estimate a token value in EUR to proceed with the off-ramping. `convertTokenToEUR` method can also be used in some scenarios/apps where token to be sent is pre-set and not selectable.

This method also returns `transferData` — a hexadecimal string which can contain token-specific transfer, unwrap or swap data that is passed in off-ramping transaction.

```js
import { Network } from '@holyheld/sdk';

(async () => {
  const data = await holyheldSDK.convertTokenToEUR(
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

### Convert EUR to token:

`convertEURToToken` method returns a calculated token amount to match provided (expected) EUR amount.

This method also returns `transferData`, that is hexadecimal string which could contain token-specific transfer, unwrap or swap data that is passed in sending to tag transaction.

```js
import { Network } from '@holyheld/sdk';

(async () => {
  const data = await holyheldSDK.convertEURToToken(
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

### Top Up:

This is the 'main' method to call that executes off-ramping to $holytag. Parameter values should be retrieved using methods described above, such as `transferData` matching token and token amount provided.

> 🚨 Some wallets like Metamask are single-network handled. It means that while Holyheld can return/accept transaction on any supported network, user **must** switch to the correct network in the wallet, in order for the transaction to be processed.

```js
import { Network, getNetworkChainId } from '@holyheld/sdk';
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
});

(async () => {
  await holyheldSDK.topup(
    publicClient,
    walletClient,
    '0x...', // wallet address
    '0x...', // token address
    Network.ethereum, // token network
    '5.25', // token amount
    transferData, // if was provided by 'convertTokenToEUR' and/or 'convertEURToToken'
    'LordSatoshi', // funds recipient tag
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

### Working with different Web3 providers

By default, a [viem](https://github.com/wagmi-dev/viem) provider is used for EVM-compatible JSON-RPC interaction. However, you can use Holyheld SDK with other providers like Ethers.js and Web3.js

#### Wagmi

```js
import { getPublicClient, getWalletClient } from '@wagmi/core';

const chainId; // token chain id

(async () => {
  const publicClient = getPublicClient({ chainId });
  const walletClient = await getWalletClient({ chainId });
})();
```

#### Ethers.js

```js
import { providers } from 'ethers';

const chain; // chain entity from viem

const provider = new providers.Web3Provider(window.ethereum);

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

const walletClient = createWalletClient({
  chain,
  transport: custom(provider.provider),
});
```

#### Web3.js

```js
import Web3 from 'web3';

const chain; // chain entity from viem

const provider = new Web3(window.ethereum).currentProvider;

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

const walletClient = createWalletClient({
  chain,
  transport: custom(provider),
});
```

## Utilities

You can use the utilities to work with networks that the sdk supports:

```js
import { Network, getNetwork, getNetworkByChainId, getNetworkChainId } from '@holyheld/sdk';

getNetwork(Network.ethereum); // NetworkInfo

getNetworkByChainId(1); // NetworkInfo

getNetworkChainId(Network.ethereum); // 1
```

Types:

```typescript
type APIKeys = {
  INFURA_PROJECT_ID: string;
};

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
  explorer: string; // example: 'https://polygonscan.com'
  // block explorer name (e.g. to display user friendly link 'view on X')
  explorerName: string; // example: 'Polygonscan'
  // base asset (native/gas token) of the network
  baseAsset: Token;
  // RPC URLs array (array supported for redundancy purposes)
  rpcUrl: (apiKeys?: Partial<APIKeys>) => string[]; // example: () => [`https://polygon-rpc.com/`]
  // logo (picture) for the network, displayed near token logo to identify on which network the token is on
  iconURL: string; // example: 'data:image/png;base64,...'
  // name of the network to display
  displayedName: string; // example: 'Polygon'
};
```

## Error handling

Some errors have the class `HolyheldSDKError`. The most helpful property of these errors is code. You can compare code with the values in the `HolyheldSDKErrorCode`.

```js
import { HolyheldSDKError, HolyheldSDKErrorCode } from '@holyheld/sdk';

const holyheldSDK = new HolyheldSDK({
  apiKey: process.env.HOLYHELD_SDK_API_KEY,
})

(async () => {
  try {
    await holyheldSDK.topup(/* ... */);
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
  UnsupportedNetwork = 'HSDK_UN', // wallet active network is not supported by SDK
  InvalidTopUpAmount = 'HSDK_ITUA', // amount does not meet minimum or maximum allowed criteria
  UnexpectedWalletNetwork = 'HSDK_UWN', // wallet active network is different from the selected network
  UserRejectedSignature = 'HSDK_RS', // user rejected the signature
  UserRejectedTransaction = 'HSDK_RT', // user rejected transaction
  FailedSettings = 'HSDK_FS', // cannot get settings
  FailedTagInfo = 'HSDK_FTI', //  cannot get $holytag info
  FailedWalletBalances = 'HSDK_FWB', // cannot get wallet balance
  FailedConversion = 'HSDK_FC', // cannot estimate EUR to TOKEN, or TOKEN to EUR
  FailedTopUp = 'HSDK_FTU', // cannot complete top up
}
```

## Logging

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

## License

Business Source License 1.1.
