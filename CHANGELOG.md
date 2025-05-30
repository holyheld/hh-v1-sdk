# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.4] - 2025-05-30

### Bug Fixes

- Fixed return values in internal methods

## [4.0.3] - 2025-05-22

### Bug Fixes

- Fixed return values in internal methods

## [4.0.2] - 2025-05-20

### Bug Fixes

- Renamed method `evm.offRamp.getAvailableEVMNetworks` to `evm.offRamp.getAvailableNetworks`

## [4.0.1] - 2025-05-19

### Features

- Added support for the Solana network (currently available for off-ramp only)

### BREAKING CHANGES

- SDK structure has changed: network-specific functionality is now accessed via sdk.evm and sdk.solana namespaces (e.g. sdk.evm.offRamp, sdk.solana.offRamp). Each level in the hierarchy (e.g. sdk, sdk.evm) may expose shared methods relevant to all submodules
- One method was renamed: `offRamp.getTagInfoForTopUp` → `getTagInfo`
- Some methods now accept a single configuration object instead of multiple positional arguments: `offRamp.convertTokenToEUR`, `offRamp.convertEURToToken`, `offRamp.getTopUpEstimation`, `offRamp.topup`, `onRamp.convertTokenToEUR`, `onRamp.convertEURToToken`, `onRamp.getOnRampEstimation`, `onRamp.requestOnRamp`
- The return structure of the method `evm.getWalletBalances` has changed
- Some TypeScript types were renamed for consistency with the new SDK structure: `RequestOnRampResult` → `RequestOnRampEVMResult`, `WalletBalances` → `WalletBalancesEVM`, `WalletToken` → `WalletTokenEVM`, `ConvertTopUpData` → `ConvertTopUpDataEVM`, `TransferData` → `TransferDataEVM`, `NetworkInfo` → `NetworkInfoEVM`
- The SDK now requires a Node.js Buffer polyfill

See the updated [documentation](https://holyheld.com/documentation/introduction) for details

## [3.2.5] - 2025-03-31

### Features
- Corrected HTTP headers in requests

## [3.2.4] - 2025-03-31

### Features
- Updated dependencies: viem and internal tools

## [3.2.3] - 2025-03-06

### Features
- Added networks (sonic, hyperliquid, berachain, plum)
- Updated viem to ^2.22.23

## [3.2.2] - 2025-01-31

### Features

- Updated dependencies: viem and internal tools

## [3.2.1] - 2024-12-19

### Bug Fixes

- Fixed the method `onRamp.watchRequestId`

## [3.2.0] - 2024-12-19

### Features

- Added method `onRamp.getOnRampEstimation`

### BREAKING CHANGES

- Changed the arguments and the return value of the method `onRamp.watchRequestId`. See [documentation](https://holyheld.com/documentation/on-ramp-flow)
- Changed the arguments of the method `offRamp.getTopUpEstimation`. See [documentation](https://holyheld.com/documentation/on-ramp-flow)
- The `offRamp.getTopUpEstimation` method now supports estimation only for native tokens used for gas fees.

## [3.1.0] - 2024-11-28

### Features

- Fixed conversion methods `onRamp.convertTokenToEUR` and `onRamp.convertEURToToken`
- Added properties `minOnRampAmountInEUR` and `maxOnRampAmountInEUR` in the method `getServerSettings`

### BREAKING CHANGES

- Method `onRamp.requestOnRamp` no longer requires `WalletClient` to be passed. Changed the order and number of arguments. See [documentation](https://holyheld.com/documentation/on-ramp-flow)
- Changed the arguments in the methods `onRamp.convertTokenToEUR` and `onRamp.convertEURToToken`. See [documentation](https://holyheld.com/documentation/on-ramp-flow)

## [3.0.1] - 2024-11-26

### Bug Fixes

- Fixed the method `onRamp.getAvailableNetworks`

## [3.0.0] - 2024-11-19

### Features

- Added on-ramp flow
- The documentation moved to the [website](https://holyheld.com/documentation/introduction)

### BREAKING CHANGES

- The methods `getTagInfoForTopUp`, `convertTokenToEUR`, `convertEURToToken`, and `topup` are now invoked via the `offRamp` object for the off-ramp flow. For example: `holyheldSDK.offRamp.getTagInfoForTopUp('SDKTEST')`

## [2.1.2] - 2024-09-06

### Features

- Changed the maximum limit for the test tag (1 EUR)

## [2.1.1] - 2024-08-19

### Features

- Added networks (bsc, manta, alephzero)

## [2.1.0] - 2024-08-16

### Features

- Added method `validateAddress`

## [2.0.0] - 2024-03-22

### Features

- Added methods `getAvailableNetworks` and `getTopUpEstimation`
- Updated viem to ^2.7.8

### BREAKING CHANGES

- Added `init` asynchronous method that must be called after instantiating an SDK object
- Changed the way to call utility methods `getNetwork`, `getNetworkByChainId`, `getNetworkChainId`: after SDK initialization they are available as SDK object methods
- Changed the return value in utility methods `getNetwork` and `getNetworkByChainId`, see `NetworkInfo` type in README

## [1.2.4] - 2024-02-12

### Bug Fixes

- Fixed maximum amount calculation

## [1.2.3] - 2023-12-26

### Bug Fixes

- Fixed getting an avatar in the method `getTagInfoForTopUp`

## [1.2.2] - 2023-11-29

### Bug Fixes

- Fixed error handling in methods: `getServerSettings`, `getTagInfoForTopUp`, `convertTokenToEUR`, `convertEURToToken`

## [1.2.1] - 2023-11-23

### Bug Fixes

- Updated `files` field in package.json

## [1.2.0] - 2023-11-23

### Features

- Updated USDC to Circle USDC for Polygon and Optimism
