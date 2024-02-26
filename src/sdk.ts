import BigNumber from 'bignumber.js';
import type { Address, PublicClient, WalletClient, Transport, Chain } from 'viem';
import Core, {
  CardTopUpOnChainService,
  PermitOnChainService,
  Permit2OnChainService,
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
  WalletList,
  ClientType,
} from '@holyheld/web-app-shared/sdklib/bundle';
import {
  CORE_SERVICE_BASE_URL,
  ASSET_SERVICE_BASE_URL,
  API_VIEW_BASE_URL,
  TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY,
  TEST_HOLYTAG,
} from './constants';
import { createWalletClientAdapter } from './helpers';
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
  private isInitialized: boolean = false;

  constructor(protected readonly options: HolyheldSDKOptions) {
    const permitService = new PermitOnChainService();
    const permit2Service = new Permit2OnChainService();
    const approvalService = new HHAPIApprovalService(API_VIEW_BASE_URL, '');

    this.topupService = new CardTopUpOnChainService(permitService, approvalService, permit2Service);
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

  public async init(): Promise<void> {
    try {
      const config = await this.settingsService.getClientConfigExternal('sdk', this.options.apiKey);
      Core.setConfig(config.references.networks);
      this.isInitialized = true;
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

  private checkInitialization(): void {
    if (!this.isInitialized) {
      throw new HolyheldSDKError(HolyheldSDKErrorCode.NotInitialized, 'SDK is not initialized');
    }
  }

  public getAvailableNetworks() {
    this.checkInitialization();

    return Core.getAvailableNetworks();
  }

  public getNetwork(network: Network) {
    this.checkInitialization();

    return Core.getNetwork(network);
  }

  public getNetworkChainId(network: Network) {
    this.checkInitialization();

    return Core.getChainId(network);
  }

  public getNetworkByChainId(chainId: number) {
    this.checkInitialization();

    return Core.getNetworkByChainId(chainId);
  }

  public async getServerSettings(): Promise<ServerExternalSettings> {
    this.checkInitialization();

    try {
      return await this.settingsService.getServerSettingsExternal(this.options.apiKey);
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

  public async getTagInfoForTopUp(tag: string): Promise<GetTagDataForTopUpExternalResponse> {
    this.checkInitialization();

    try {
      return await this.tagService.getTagDataForTopUpExternal(tag, this.options.apiKey);
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

  public async getWalletBalances(
    address: string,
  ): Promise<Pick<GetMultiChainWalletTokensResponse, 'tokens'>> {
    this.checkInitialization();

    try {
      const { tokens } = await this.assetService.getMultiChainWalletTokensExternal(
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

  public async convertTokenToEUR(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellAmount: string,
    network: Network,
  ): Promise<ConvertEURData> {
    this.checkInitialization();

    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getSwapTargetForTopUp(network);

    try {
      return await this.swapService.convertTokenToEURForTopUpExternal(
        usdc.address,
        usdc.decimals,
        sellTokenAddress as Address,
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

  public async convertEURToToken(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellEURAmount: string,
    network: Network,
  ): Promise<ConvertEURData> {
    this.checkInitialization();

    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getSwapTargetForTopUp(network);

    try {
      return await this.swapService.convertEURToTokenForTopUpExternal(
        usdc.address,
        usdc.decimals,
        sellTokenAddress as Address,
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

  public async getTopUpEstimation(network: Network): Promise<string> {
    this.checkInitialization();

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

  public async topup(
    publicClient: PublicClient<Transport, Chain>,
    walletClient: WalletClient,
    senderAddress: string,
    tokenAddress: string,
    tokenNetwork: Network,
    tokenAmount: string,
    transferData: TransferData | undefined,
    tag: string,
    supportsSignTypedDataV4: boolean = false,
    config?: TopUpCallbackConfig,
  ): Promise<void> {
    this.checkInitialization();

    try {
      await this.auditService.sendAuditEventExternal(
        {
          transferData,
          tokenAmount,
          tokenAddress,
          network: tokenNetwork,
        },
        senderAddress as Address,
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
        tokenAddress as Address,
        tokenNetwork,
        this.options.apiKey,
      );

      const convertData = await this.convertTokenToEUR(
        inputAsset.address,
        inputAsset.decimals,
        tokenAmount,
        tokenNetwork,
      );

      if (
        !Core.isSettlementTokenForTopUp(inputAsset.address, inputAsset.network) &&
        transferData === undefined
      ) {
        transferData = convertData.transferData;
      }

      const settings = await this.getServerSettings();

      if (
        tag.toLowerCase() !== TEST_HOLYTAG.toLowerCase() &&
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
          new BigNumber(settings.external.maxTopUpAmountInEUR).multipliedBy(new BigNumber(1.01)),
        )
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidTopUpAmount,
          `Maximum allowed amount is ${settings.external.maxTopUpAmountInEUR} EUR`,
        );
      }

      let swapTargetPrice = '0';

      const isSwapTarget = Core.isSwapTargetForTopUp(tokenAddress as Address, tokenNetwork);
      const isSettlementToken = Core.isSettlementTokenForTopUp(
        tokenAddress as Address,
        tokenNetwork,
      );
      const isEURSettlementToken =
        isSettlementToken &&
        (Core.getSettlementTokensForTopUp(tokenNetwork).find((st) =>
          Core.sameAddress(st.address, tokenAddress),
        )?.isEURStableCoin ??
          false);

      if (!isSwapTarget && !isEURSettlementToken) {
        const swapTarget = Core.getSwapTargetForTopUp(tokenNetwork);

        const swapTargetPrices = await this.assetService.getTokenPricesExternal(
          [{ address: swapTarget.address, network: swapTarget.network }],
          this.options.apiKey,
        );

        if (swapTargetPrices.length !== 1) {
          throw new HHError('Failed to get token price');
        }

        swapTargetPrice = swapTargetPrices[0].price;
      }

      await this.topupService.topUpCompound(
        senderAddress as Address,
        publicClient,
        createWalletClientAdapter(walletClient),
        inputAsset,
        tokenAmount,
        swapTargetPrice,
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
                senderAddress as Address,
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

  public async getWalletList(type: ClientType): Promise<WalletList> {
    const config = await this.settingsService.getClientConfigExternal(type, this.options.apiKey);
    return config.wallets;
  }
}
