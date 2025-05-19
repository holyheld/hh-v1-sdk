import {
  SolanaNetwork,
  type TokenSolana,
  type NetworkInfoSolana,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { HolyheldSDKInterface, RequiredServiceList, WalletBalancesSolana } from '../sdk.types';

export interface SdkSolanaOptions {
  common: HolyheldSDKInterface;
  services: RequiredServiceList<
    'approvalService' | 'assetService' | 'swapService' | 'txTagService'
  >;
}

export interface SdkSolanaInterface {
  getAvailableNetworks(): SolanaNetwork[];

  isSolanaNetwork(network: SolanaNetwork): boolean;

  getNetwork(network: SolanaNetwork): NetworkInfoSolana | undefined;

  getWalletBalances(address: string): Promise<WalletBalancesSolana>;

  getTokenByAddressAndNetwork(address: string, network: SolanaNetwork): Promise<TokenSolana>;
}
