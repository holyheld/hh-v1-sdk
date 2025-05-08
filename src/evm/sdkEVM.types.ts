import {
  Network,
  type NetworkInfoEVM,
  type TokenEVM,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { HolyheldSDKInterface, RequiredServiceList, WalletBalancesEVM } from '../sdk.types';

export interface SdkEVMOptions {
  common: HolyheldSDKInterface;
  services: RequiredServiceList<
    | 'txTagService'
    | 'permitService'
    | 'approvalService'
    | 'assetService'
    | 'swapService'
    | 'onRampService'
    | 'nonceService'
  >;
}

export interface SdkEVMInterface {
  getAvailableNetworks(): Network[];

  isEVMNetwork(network: Network): boolean;

  getNetwork(network: Network): NetworkInfoEVM | undefined;

  getNetworkChainId(network: Network): number;

  getNetworkByChainId(chainId: number): NetworkInfoEVM | undefined;

  getWalletBalances(address: string): Promise<WalletBalancesEVM>;

  getTokenByAddressAndNetwork(address: string, network: Network): Promise<TokenEVM>;
}
