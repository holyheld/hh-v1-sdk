import Core, {
  HHAPIAssetsServiceExternal,
  HHAPITxTagServiceExternal,
  HHAPITagServiceExternal,
  HHAPISettingsServiceExternal,
  HHAPIAuditServiceExternal,
  HHAPISwapServiceExternal,
  HHAPIApprovalServiceExternal,
  HHAPIOnRampServiceExternal,
  HHAPINonceServiceExternal,
  HHError,
  PermitOnChainService,
  type ServerExternalSettings,
} from '@holyheld/web-app-shared/sdklib/bundle';
import {
  CORE_SERVICE_BASE_URL,
  ASSET_SERVICE_BASE_URL,
  API_VIEW_BASE_URL,
  CLIENT_TYPE,
} from './constants';
import { LogLevel, createDefaultLogger, type Logger } from './logger';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
import { getAuthorizer } from './helpers';
import SdkEVM from './evm/sdkEVM';
import SdkSolana from './solana/sdkSolana';
import type {
  HolyheldSDKInterface,
  HolyheldSDKOptions,
  TagInfo,
  ValidateAddressResult,
} from './sdk.types';

export default class HolyheldSDK implements HolyheldSDKInterface {
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalServiceExternal;
  readonly #assetService: HHAPIAssetsServiceExternal;
  readonly #txTagService: HHAPITxTagServiceExternal;
  readonly #tagService: HHAPITagServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;
  readonly #auditService: HHAPIAuditServiceExternal;
  readonly #settingsService: HHAPISettingsServiceExternal;
  readonly #onRampService: HHAPIOnRampServiceExternal;
  readonly #nonceService: HHAPINonceServiceExternal;

  readonly #logger: Logger;

  readonly evm: SdkEVM;
  readonly solana: SdkSolana;

  #isInitialized: boolean = false;

  constructor(protected readonly options: HolyheldSDKOptions) {
    const authorizer = getAuthorizer(options.apiKey);

    this.#permitService = new PermitOnChainService();
    this.#approvalService = new HHAPIApprovalServiceExternal({
      baseURL: API_VIEW_BASE_URL,
      proxyBaseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#assetService = new HHAPIAssetsServiceExternal({
      baseURL: ASSET_SERVICE_BASE_URL,
      authorizer: getAuthorizer(options.apiKey, { 'X-Api-Client-Type': CLIENT_TYPE }),
    });
    this.#txTagService = new HHAPITxTagServiceExternal({
      baseURL: API_VIEW_BASE_URL,
      coreBaseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#tagService = new HHAPITagServiceExternal({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#swapService = new HHAPISwapServiceExternal({
      baseURL: ASSET_SERVICE_BASE_URL,
      authorizer,
    });
    this.#auditService = new HHAPIAuditServiceExternal({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#settingsService = new HHAPISettingsServiceExternal({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#onRampService = new HHAPIOnRampServiceExternal({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });
    this.#nonceService = new HHAPINonceServiceExternal({
      baseURL: CORE_SERVICE_BASE_URL,
      authorizer,
    });

    this.#logger = options.logger === true ? createDefaultLogger() : options.logger || (() => {});

    Core.setExecutor({
      addSentryBreadcrumb: ({ level, message, data }) => {
        if (!level || !message) {
          return;
        }
        const lvl = Object.values(LogLevel).includes(level as LogLevel) ? level : LogLevel.Warning;
        this.#logger(lvl as LogLevel, message, data);
      },
    });

    this.evm = new SdkEVM({
      common: this,
      services: {
        onRampService: this.#onRampService,
        swapService: this.#swapService,
        permitService: this.#permitService,
        txTagService: this.#txTagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
        nonceService: this.#nonceService,
      },
    });

    this.solana = new SdkSolana({
      common: this,
      services: {
        swapService: this.#swapService,
        txTagService: this.#txTagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
      },
    });
  }

  async init(): Promise<void> {
    try {
      const config = await this.#settingsService.getClientConfig({ clientType: CLIENT_TYPE });
      Core.setConfig(config.evmNetworks);
      Core.setSolanaConfig(config.solanaNetwork);
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

  async getServerSettings(): Promise<ServerExternalSettings> {
    this.assertInitialized();

    try {
      return await this.#settingsService.getServerSettings();
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

  async getTagInfo(holytag: string): Promise<TagInfo> {
    this.assertInitialized();

    try {
      const data = await this.#tagService.getTagPublicDataForTopUp({ tag: holytag });
      return {
        found: data.found,
        avatarSrc: data.avatarSrc ?? undefined,
        tag: data.tag ?? undefined,
      };
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedTagInfo,
          'Failed to get tag information for top up',
          error,
        );
      }

      throw error;
    }
  }

  async validateAddress(address: string): Promise<ValidateAddressResult> {
    this.assertInitialized();

    try {
      return await this.#tagService.validateAddress({ address });
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

  async sendAudit(params: {
    data: Record<string, unknown>;
    address: string;
    operationId?: string | undefined;
  }): Promise<void> {
    try {
      await this.#auditService.sendAuditEvent(params.data, params.address, params.operationId);
    } catch (error) {
      this.#logger(LogLevel.Warning, 'Failed to send audit event');
    }
  }
}
