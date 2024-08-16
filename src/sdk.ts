import type { Address } from 'viem';
import Core, {
  HHAPIAssetsService,
  HHAPITagService,
  HHAPISettingsService,
  HHAPIAuditService,
  Network,
  HHError,
  HHAPISwapService,
  HHAPIEstimationService,
  HHAPIApprovalService,
  PermitOnChainService,
  HHAPIOnRampService,
  Token,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type {
  GetMultiChainWalletTokensResponse,
  ValidateAddressExternalExternalResponse,
  ServerExternalSettings,
  WalletList,
  ClientType,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { CORE_SERVICE_BASE_URL, ASSET_SERVICE_BASE_URL, API_VIEW_BASE_URL } from './constants';
import { LogLevel, createDefaultLogger } from './logger';
import type { Logger } from './logger';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
import { HolyheldSDKCommon } from './types';
import { OnRampSDK } from './onRampSDK';
import OffRampSDK from './offRampSDK';

export interface HolyheldSDKOptions {
  apiKey: string;
  logger?: Logger | boolean;
}

export default class HolyheldSDK implements HolyheldSDKCommon {
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalService;
  readonly #assetService: HHAPIAssetsService;
  readonly #tagService: HHAPITagService;
  readonly #swapService: HHAPISwapService;
  readonly #auditService: HHAPIAuditService;
  readonly #settingsService: HHAPISettingsService;
  readonly #estimationService: HHAPIEstimationService;
  readonly #onRampService: HHAPIOnRampService;
  protected readonly logger: Logger;
  #isInitialized: boolean = false;

  public readonly onRamp: OnRampSDK;
  public readonly offRamp: OffRampSDK;

  constructor(protected readonly options: HolyheldSDKOptions) {
    this.#permitService = new PermitOnChainService();
    this.#approvalService = new HHAPIApprovalService(API_VIEW_BASE_URL, '');
    this.#assetService = new HHAPIAssetsService(ASSET_SERVICE_BASE_URL, 'sdk');
    this.#tagService = new HHAPITagService(CORE_SERVICE_BASE_URL);
    this.#swapService = new HHAPISwapService(ASSET_SERVICE_BASE_URL);
    this.#auditService = new HHAPIAuditService(CORE_SERVICE_BASE_URL);
    this.#settingsService = new HHAPISettingsService(CORE_SERVICE_BASE_URL);
    this.#estimationService = new HHAPIEstimationService(ASSET_SERVICE_BASE_URL);
    this.#onRampService = new HHAPIOnRampService(CORE_SERVICE_BASE_URL);

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
      },
      apiKey: this.options.apiKey,
      logger: this.logger,
    });

    this.offRamp = new OffRampSDK({
      commonSDK: this,
      services: {
        permitService: this.#permitService,
        tagService: this.#tagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
        swapService: this.#swapService,
        estimationService: this.#estimationService,
      },
      apiKey: this.options.apiKey,
      logger: this.logger,
    });
  }

  public async init(): Promise<void> {
    try {
      const config = await this.#settingsService.getClientConfigExternal(
        'sdk',
        this.options.apiKey,
      );
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
      return await this.#settingsService.getServerSettingsExternal(this.options.apiKey);
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

  public async validateAddress(address: string): Promise<ValidateAddressExternalExternalResponse> {
    this.assertInitialized();

    try {
      return await this.#tagService.validateAddressExternal(address, this.options.apiKey);
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

  public async getWalletBalances(
    address: string,
  ): Promise<Pick<GetMultiChainWalletTokensResponse, 'tokens'>> {
    this.assertInitialized();

    try {
      const { tokens } = await this.#assetService.getMultiChainWalletTokensExternal(
        address as Address,
        this.options.apiKey,
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
    const config = await this.#settingsService.getClientConfigExternal(type, this.options.apiKey);
    return config.wallets;
  }

  public async getTokenByAddressAndNetwork(address: Address, network: Network): Promise<Token> {
    return await this.#assetService.getTokenData(address, network);
  }

  async sendAudit(params: {
    data: Record<string, unknown>;
    address: `0x${string}`;
    apikey: string;
    operationId?: string | undefined;
  }): Promise<void> {
    try {
      await this.#auditService.sendAuditEventExternal(
        params.data,
        params.address,
        this.options.apiKey,
        params.operationId,
      );
    } catch (error) {
      this.logger(LogLevel.Warning, 'Failed to send audit event');
    }
  }
}
