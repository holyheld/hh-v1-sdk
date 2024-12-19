import {
  HHAPIApprovalService,
  HHAPIAssetsService,
  HHAPIAuditService,
  HHAPIOnRampService,
  HHAPISettingsService,
  HHAPISwapService,
  HHAPITagService,
  PermitOnChainService,
  Network,
  type NetworkInfo,
  type Token,
  type ValidateAddressExternalExternalResponse,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type {
  ClientType,
  GetMultiChainWalletTokensResponse,
  ServerExternalSettings,
  WalletList,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Address } from 'viem';

export interface HolyheldSDKCommon {
  init(): Promise<void>;

  assertInitialized(): void;

  getAllAvailableNetworks(): Network[];

  getNetwork(network: Network): NetworkInfo | undefined;

  getNetworkChainId(network: Network): number;

  getNetworkByChainId(chainId: number): NetworkInfo | undefined;

  getTokenByAddressAndNetwork(address: Address, network: Network): Promise<Token>;

  getServerSettings(): Promise<ServerExternalSettings>;

  validateAddress(address: string): Promise<ValidateAddressExternalExternalResponse>;

  getWalletBalances(address: string): Promise<Pick<GetMultiChainWalletTokensResponse, 'tokens'>>;

  getWalletList(type: ClientType): Promise<WalletList>;

  sendAudit(params: {
    data: Record<string, unknown>;
    address: `0x${string}`;
    apiKey: string;
    operationId?: string | undefined;
  }): Promise<void>;
}

export type ServiceList = {
  permitService?: PermitOnChainService;
  approvalService?: HHAPIApprovalService;
  assetService?: HHAPIAssetsService;
  tagService?: HHAPITagService;
  swapService?: HHAPISwapService;
  auditService?: HHAPIAuditService;
  settingsService?: HHAPISettingsService;
  onRampService?: HHAPIOnRampService;
};

export type RequiredServiceList<Keys extends keyof ServiceList> = Required<Pick<ServiceList, Keys>>;
