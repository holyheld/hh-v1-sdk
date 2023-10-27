import Core from '@holyheld/web-app-shared/sdklib/bundle';

const { getNetwork, getChainId: getNetworkChainId, getNetworkByChainId } = Core;

export { getNetwork, getNetworkChainId, getNetworkByChainId };
export { LogLevel } from './logger';
export type { Logger } from './logger';
export { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
export { Network } from '@holyheld/web-app-shared/sdklib/bundle';
export type {
  TransferData,
  APIKeys,
  Token,
  NetworkInfo,
  WalletToken,
} from '@holyheld/web-app-shared/sdklib/bundle';
export { TopUpStep } from './sdk';
export type { TopUpCallbackConfig } from './sdk';
export { default } from './sdk';
