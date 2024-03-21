# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
