import type { Address } from 'viem';
import Core, {
  HHAPIAssetsService,
  HHAPITagService,
  HHAPISettingsService,
  HHAPIAuditService,
  HHAPISwapService,
  HHAPIApprovalService,
  HHAPIOnRampService,
  HHError,
  PermitOnChainService,
  Network,
  type Token,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type {
  ServerExternalSettings,
  WalletList,
  ClientType,
  WalletToken,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Logger } from './logger';
import type { HolyheldSDKCommon } from './types';
import {
  CORE_SERVICE_BASE_URL,
  ASSET_SERVICE_BASE_URL,
  API_VIEW_BASE_URL,
  CLIENT_TYPE,
} from './constants';
import { LogLevel, createDefaultLogger } from './logger';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
import OnRampSDK from './onRampSDK';
import OffRampSDK from './offRampSDK';
import { getAuthorizer } from './helpers';

export interface HolyheldSDKOptions {
  apiKey: string;
  logger?: Logger | boolean;
}

export type ValidateAddressResult = {
  isTopupAllowed: boolean;
  isOnRampAllowed: boolean;
};

export type WalletBalances = {
  tokens: WalletToken[];
};

export default class HolyheldSDK implements HolyheldSDKCommon {
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalService;
  readonly #assetService: HHAPIAssetsService;
  readonly #tagService: HHAPITagService;
  readonly #swapService: HHAPISwapService;
  readonly #auditService: HHAPIAuditService;
  readonly #settingsService: HHAPISettingsService;
  readonly #onRampService: HHAPIOnRampService;
  protected readonly logger: Logger;
  #isInitialized: boolean = false;

  public readonly onRamp: OnRampSDK;
  public readonly offRamp: OffRampSDK;

  constructor(protected readonly options: HolyheldSDKOptions) {
    const authorizer = getAuthorizer(options.apiKey);

    this.#permitService = new PermitOnChainService();
    this.#approvalService = new HHAPIApprovalService({
      baseURL: API_VIEW_BASE_URL,
      proxyBaseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#assetService = new HHAPIAssetsService({ baseURL: ASSET_SERVICE_BASE_URL, authorizer });
    this.#tagService = new HHAPITagService({ baseURL: CORE_SERVICE_BASE_URL, authorizer });
    this.#swapService = new HHAPISwapService({ baseURL: ASSET_SERVICE_BASE_URL, authorizer });
    this.#auditService = new HHAPIAuditService({ baseURL: CORE_SERVICE_BASE_URL, authorizer });
    this.#settingsService = new HHAPISettingsService({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#onRampService = new HHAPIOnRampService({ baseURL: CORE_SERVICE_BASE_URL, authorizer });

    this.logger = options.logger === true ? createDefaultLogger() : options.logger || (() => {});

    Core.setExecutor({
      addSentryBreadcrumb: ({ level, message, data }) => {
        if (!level || !message) {
          return;
        }
        const lvl = Object.values(LogLevel).includes(level as LogLevel) ? level : LogLevel.Warning;
        this.logger(lvl as LogLevel, message, data);
      },
    });

    this.onRamp = new OnRampSDK({
      commonSDK: this,
      services: {
        onRampService: this.#onRampService,
        swapService: this.#swapService,
      },
      apiKey: this.options.apiKey,
    });

    this.offRamp = new OffRampSDK({
      commonSDK: this,
      services: {
        permitService: this.#permitService,
        tagService: this.#tagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
        swapService: this.#swapService,
      },
      apiKey: this.options.apiKey,
    });
  }

  public async init(): Promise<void> {
    try {
      const config = await this.#settingsService.getClientConfigExternal(CLIENT_TYPE);
      Core.setConfig(config.references.networks);
      this.#isInitialized = true;
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedInitialization,
          'Failed to initialize SDK',
          error,
        );
      }

      throw error;
    }
  }

  assertInitialized(): void {
    if (!this.#isInitialized) {
      throw new HolyheldSDKError(HolyheldSDKErrorCode.NotInitialized, 'SDK is not initialized');
    }
  }

  public getAllAvailableNetworks(): Network[] {
    this.assertInitialized();

    return Core.getAvailableNetworks();
  }

  public getNetwork(network: Network) {
    this.assertInitialized();

    return Core.getNetwork(network);
  }

  public getNetworkChainId(network: Network) {
    this.assertInitialized();

    return Core.getChainId(network);
  }

  public getNetworkByChainId(chainId: number) {
    this.assertInitialized();

    return Core.getNetworkByChainId(chainId);
  }

  public async getServerSettings(): Promise<ServerExternalSettings> {
    this.assertInitialized();

    try {
      return await this.#settingsService.getServerSettingsExternal();
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedSettings,
          'Failed to get settings',
          error,
        );
      }

      throw error;
    }
  }

  public async validateAddress(address: string): Promise<ValidateAddressResult> {
    this.assertInitialized();

    try {
      return await this.#tagService.validateAddressExternal(address);
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedAddressInfo,
          'Failed to validate address',
          error,
        );
      }

      throw error;
    }
  }

  public async getWalletBalances(address: string): Promise<WalletBalances> {
    this.assertInitialized();

    try {
      const { tokens } = await this.#assetService.getMultiChainWalletTokensExternal(
        address as Address,
      );
      const availableNetworks = Core.getAvailableNetworks();
      return { tokens: tokens.filter((item) => availableNetworks.includes(item.network)) };
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedWalletBalances,
          'Failed to get wallet balances',
          error,
        );
      }

      throw error;
    }
  }

  public async getWalletList(type: ClientType): Promise<WalletList> {
    const config = await this.#settingsService.getClientConfigExternal(type);
    return config.wallets;
  }

  public async getTokenByAddressAndNetwork(address: Address, network: Network): Promise<Token> {
    return await this.#assetService.getTokenData(address, network);
  }

  async sendAudit(params: {
    data: Record<string, unknown>;
    address: `0x${string}`;
    apiKey: string;
    operationId?: string | undefined;
  }): Promise<void> {
    try {
      await this.#auditService.sendAuditEventExternal(
        params.data,
        params.address,
        params.operationId,
      );
    } catch (error) {
      this.logger(LogLevel.Warning, 'Failed to send audit event');
    }
  }
}
