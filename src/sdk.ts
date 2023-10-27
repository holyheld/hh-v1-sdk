import BigNumber from 'bignumber.js';
import type { Address, PublicClient, WalletClient } from 'viem';
import Core, {
  CardTopUpOnChainService,
  PermitOnChainService,
  HHAPIApprovalService,
  HHAPIAssetsService,
  HHAPITagService,
  HHAPISettingsService,
  HHAPISwapService,
  HHAPIEstimationService,
  HHAPIAuditService,
  Network,
  ExpectedError,
  EECode,
  UnexpectedError,
  HHError,
  TransactionState,
  TransactionStep,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type {
  TransferData,
  GetMultiChainWalletTokensResponse,
  GetTagDataForTopUpExternalResponse,
  ServerExternalSettings,
  ConvertEURData,
} from '@holyheld/web-app-shared/sdklib/bundle';
import {
  CORE_SERVICE_BASE_URL,
  ASSET_SERVICE_BASE_URL,
  API_VIEW_BASE_URL,
  TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY,
} from './constants';
import { LogLevel, createDefaultLogger } from './logger';
import type { Logger } from './logger';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';

export interface HolyheldSDKOptions {
  apiKey: string;
  logger?: Logger | boolean;
}

export enum TopUpStep {
  Confirming = 'confirming',
  Approving = 'approving',
  Sending = 'sending',
}

export interface TopUpCallbackConfig {
  onHashGenerate?: (hash: string) => void;
  onStepChange?: (step: TopUpStep) => void;
}

export default class HolyheldSDK {
  protected readonly topupService: CardTopUpOnChainService;
  protected readonly assetService: HHAPIAssetsService;
  protected readonly tagService: HHAPITagService;
  protected readonly swapService: HHAPISwapService;
  protected readonly auditService: HHAPIAuditService;
  protected readonly settingsService: HHAPISettingsService;
  protected readonly estimationService: HHAPIEstimationService;
  protected readonly logger: Logger;

  constructor(protected readonly options: HolyheldSDKOptions) {
    const permitService = new PermitOnChainService();
    const approvalService = new HHAPIApprovalService(API_VIEW_BASE_URL, '');

    this.topupService = new CardTopUpOnChainService(permitService, approvalService);
    this.assetService = new HHAPIAssetsService(ASSET_SERVICE_BASE_URL);
    this.tagService = new HHAPITagService(CORE_SERVICE_BASE_URL);
    this.swapService = new HHAPISwapService(ASSET_SERVICE_BASE_URL);
    this.auditService = new HHAPIAuditService(CORE_SERVICE_BASE_URL);
    this.settingsService = new HHAPISettingsService(CORE_SERVICE_BASE_URL);
    this.estimationService = new HHAPIEstimationService(ASSET_SERVICE_BASE_URL);

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
  }

  async getServerSettings(): Promise<ServerExternalSettings> {
    try {
      return this.settingsService.getServerSettingsExternal(this.options.apiKey);
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

  async getTagInfoForTopUp(tag: string): Promise<GetTagDataForTopUpExternalResponse> {
    try {
      return this.tagService.getTagDataForTopUpExternal(tag, this.options.apiKey);
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

  async getWalletBalances(
    address: string,
  ): Promise<Pick<GetMultiChainWalletTokensResponse, 'tokens'>> {
    try {
      const { tokens } = await this.assetService.getMultiChainWalletTokensExternal(
        address,
        this.options.apiKey,
      );
      return { tokens };
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

  async convertTokenToEUR(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellAmount: string,
    network: Network,
  ): Promise<ConvertEURData> {
    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getUSDCAssetData(network);

    try {
      return this.swapService.convertTokenToEURForTopUpExternal(
        usdc.address,
        usdc.decimals,
        sellTokenAddress,
        sellTokenDecimals,
        sellAmount,
        topupProxyAddress,
        topupProxyAddress,
        network,
        this.options.apiKey,
      );
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedConversion,
          'Failed to convert token to EUR',
          error,
        );
      }

      throw error;
    }
  }

  async convertEURToToken(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellEURAmount: string,
    network: Network,
  ): Promise<ConvertEURData> {
    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getUSDCAssetData(network);

    try {
      return this.swapService.convertEURToTokenForTopUpExternal(
        usdc.address,
        usdc.decimals,
        sellTokenAddress,
        sellTokenDecimals,
        sellEURAmount,
        topupProxyAddress,
        topupProxyAddress,
        network,
        this.options.apiKey,
      );
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedConversion,
          'Failed to convert EUR to token',
          error,
        );
      }

      throw error;
    }
  }

  async getTopUpEstimation(network: Network): Promise<string> {
    try {
      return (await this.estimationService.getTopUpEstimationExternal(network, this.options.apiKey))
        .priceInWei;
    } catch (error) {
      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedEstimation,
          'Failed to get top up estimation',
          error,
        );
      }

      throw error;
    }
  }

  async topup(
    publicClient: PublicClient,
    walletClient: WalletClient,
    senderAddress: Address,
    tokenAddress: string,
    tokenNetwork: Network,
    tokenAmount: string,
    transferData: TransferData | undefined,
    tag: string,
    supportsSignTypedDataV4: boolean = false,
    config?: TopUpCallbackConfig,
  ): Promise<void> {
    try {
      await this.auditService.sendAuditEventExternal(
        {
          transferData,
          tokenAmount,
          tokenAddress,
          network: tokenNetwork,
        },
        senderAddress,
        this.options.apiKey,
      );
    } catch (error) {
      this.logger(LogLevel.Warning, 'Failed to send audit event');
    }

    try {
      const chainId = await walletClient.getChainId();
      const walletNetwork = Core.getNetworkByChainId(chainId);

      if (walletNetwork === undefined) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UnsupportedNetwork,
          `Unsupported chain id: ${chainId}`,
        );
      }

      if (walletNetwork.network !== tokenNetwork) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UnexpectedWalletNetwork,
          'Wallet network must match the token network',
        );
      }

      const tagHash = await this.tagService.getTagTopUpCodeExternal(tag, this.options.apiKey);

      if (config === undefined) {
        config = {};
      }

      const inputAsset = await this.assetService.getFullTokenDataWithPriceExternal(
        tokenAddress,
        tokenNetwork,
        this.options.apiKey,
      );

      const convertData = await this.convertTokenToEUR(
        inputAsset.address,
        inputAsset.decimals,
        tokenAmount,
        tokenNetwork,
      );

      if (!Core.isSettlementToken(inputAsset) && transferData === undefined) {
        transferData = convertData.transferData;
      }

      const settings = await this.getServerSettings();

      if (
        new BigNumber(convertData.EURAmount).lt(
          new BigNumber(settings.external.minTopUpAmountInEUR).multipliedBy(new BigNumber(0.99)),
        )
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidTopUpAmount,
          `Minimum allowed amount is ${settings.external.minTopUpAmountInEUR} EUR`,
        );
      }

      if (
        new BigNumber(convertData.EURAmount).gt(
          new BigNumber(settings.external.maxTopUpAmountInEUR).multipliedBy(new BigNumber(1.0001)),
        )
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidTopUpAmount,
          `Maximum allowed amount is ${settings.external.maxTopUpAmountInEUR} EUR`,
        );
      }

      const usdc = Core.getUSDCAssetData(tokenNetwork);

      const usdcPriceReturn = await this.assetService.getTokenPricesExternal(
        [{ address: usdc.address, network: tokenNetwork }],
        this.options.apiKey,
      );

      if (usdcPriceReturn.length !== 1) {
        throw new HHError('Failed to get token price');
      }

      await this.topupService.topUpCompound(
        senderAddress,
        publicClient,
        walletClient,
        inputAsset,
        tokenAmount,
        inputAsset.priceUSD,
        usdcPriceReturn[0].price,
        transferData,
        tagHash,
        supportsSignTypedDataV4,
        {},
        {
          onTransactionHash: (hash: string) => {
            config?.onHashGenerate?.(hash);
          },
          eventBus: {
            emit: (payload) => {
              if (payload.state === TransactionState.Pending) {
                let value: TopUpStep;

                switch (payload.type) {
                  case TransactionStep.Confirm:
                    value = TopUpStep.Confirming;
                    break;
                  case TransactionStep.Approve:
                    value = TopUpStep.Approving;
                    break;
                  default:
                    value = TopUpStep.Sending;
                    break;
                }

                config?.onStepChange?.(value);
              }
            },
          },
          onCallData: async (payload) => {
            try {
              await this.auditService.sendTxCallDataAuditEventExternal(
                payload,
                senderAddress,
                this.options.apiKey,
              );
            } catch (error) {
              this.logger(LogLevel.Warning, 'Failed to send call data to the audit service');
            }
          },
        },
      );
    } catch (error) {
      if (error instanceof HolyheldSDKError) {
        throw error;
      }

      if (error instanceof ExpectedError && error.getCode() === EECode.userRejectSign) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UserRejectedSignature,
          'User rejected the signature request',
          error,
        );
      }

      if (error instanceof ExpectedError && error.getCode() === EECode.userRejectTransaction) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UserRejectedTransaction,
          'User rejected the transaction',
          error,
        );
      }

      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedTopUp,
          `Top up failed${error instanceof UnexpectedError ? ` with code ${error.getCode()}` : ''}`,
          error,
        );
      }

      throw error;
    }
  }
}
