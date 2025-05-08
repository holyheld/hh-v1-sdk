import {
  HHAPIApprovalServiceExternal,
  HHAPIAssetsServiceExternal,
  HHAPIAuditServiceExternal,
  HHAPIOnRampServiceExternal,
  HHAPISettingsServiceExternal,
  HHAPISwapServiceExternal,
  HHAPITagServiceExternal,
  HHAPITxTagServiceExternal,
  HHAPINonceServiceExternal,
  PermitOnChainService,
  type ServerExternalSettings,
  type TokenEVM,
  type TokenSolana,
  type WithBalance,
  type WithGroupId,
  type WithPermitData,
  type WithPrice,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Logger } from './logger';

export type ServiceList = {
  permitService?: PermitOnChainService;
  approvalService?: HHAPIApprovalServiceExternal;
  assetService?: HHAPIAssetsServiceExternal;
  tagService?: HHAPITagServiceExternal;
  txTagService?: HHAPITxTagServiceExternal;
  swapService?: HHAPISwapServiceExternal;
  auditService?: HHAPIAuditServiceExternal;
  settingsService?: HHAPISettingsServiceExternal;
  onRampService?: HHAPIOnRampServiceExternal;
  nonceService?: HHAPINonceServiceExternal;
};

export interface HolyheldSDKOptions {
  apiKey: string;
  logger?: Logger | boolean;
}

export type ValidateAddressResult = {
  isTopupAllowed: boolean;
  isOnRampAllowed: boolean;
};

export type WalletTokenEVM = WithGroupId<WithBalance<WithPrice<WithPermitData<TokenEVM>>>>;

export type WalletTokenSolana = WithGroupId<WithBalance<WithPrice<TokenSolana>>>;

export type WalletBalancesEVM = {
  tokens: WalletTokenEVM[];
};

export type WalletBalancesSolana = {
  tokens: WalletTokenSolana[];
};

export type TagInfo = {
  found: boolean;
  avatarSrc?: string;
  tag?: string;
};

export type RequiredServiceList<Keys extends keyof ServiceList> = Required<Pick<ServiceList, Keys>>;

export enum TopUpStep {
  Confirming = 'confirming',
  Approving = 'approving',
  Sending = 'sending',
}

export interface TopUpCallbackConfig {
  onHashGenerate?: (hash: string) => void;
  onStepChange?: (step: TopUpStep) => void;
}

export type EstimateOnRampResult = {
  expectedAmount: string;
  feeAmount: string;
};

export type WatchOnRampResult = {
  success: boolean;
  hash?: string;
};

export type WatchOnRampRequestIdOptions = {
  timeout?: number;
  waitForTransactionHash?: boolean;
};

export interface HolyheldSDKInterface {
  init(): Promise<void>;

  assertInitialized(): void;

  getServerSettings(): Promise<ServerExternalSettings>;

  getTagInfo(holytag: string): Promise<TagInfo>;

  validateAddress(address: string): Promise<ValidateAddressResult>;

  sendAudit(params: {
    data: Record<string, unknown>;
    address: string;
    operationId?: string | undefined;
  }): Promise<void>;
}
