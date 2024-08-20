import BigNumber from 'bignumber.js';
import type { Address, Chain, PublicClient, Transport, WalletClient } from 'viem';
import type {
  ConvertEURData,
  GetTagDataForTopUpExternalResponse,
  TransferData,
} from '@holyheld/web-app-shared/sdklib/bundle';
import Core, {
  CardTopUpOnChainService,
  ExpectedError,
  HHAPIApprovalService,
  HHAPIAssetsService,
  HHAPIEstimationService,
  HHAPISwapService,
  HHAPITagService,
  HHError,
  Network,
  Permit2OnChainService,
  PermitOnChainService,
  TransactionState,
  TransactionStep,
  UnexpectedError,
  isDefaultAddress,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { TEST_HOLYTAG, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY } from './constants';
import { createWalletClientAdapter } from './helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
import { createWalletInfoAdapter } from './helpers';
import { HolyheldSDKCommon, RequiredServiceList } from './types';

export interface HolyheldOffRampSDKOptions {
  commonSDK: HolyheldSDKCommon;
  services: RequiredServiceList<
    | 'tagService'
    | 'permitService'
    | 'approvalService'
    | 'assetService'
    | 'swapService'
    | 'estimationService'
  >;
  apiKey: string;
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

export default class OffRampSDK {
  readonly #tagService: HHAPITagService;
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalService;
  readonly #assetService: HHAPIAssetsService;
  readonly #swapService: HHAPISwapService;
  readonly #estimationService: HHAPIEstimationService;
  readonly #common: HolyheldSDKCommon;

  constructor(protected readonly options: HolyheldOffRampSDKOptions) {
    this.#permitService = options.services.permitService;
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#tagService = options.services.tagService;
    this.#estimationService = options.services.estimationService;

    this.#common = options.commonSDK;
  }

  public async getTagInfoForTopUp(tag: string): Promise<GetTagDataForTopUpExternalResponse> {
    this.#common.assertInitialized();

    try {
      return await this.#tagService.getTagDataForTopUpExternal(tag, this.options.apiKey);
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

  public getAvailableNetworks(): Network[] {
    const all = this.#common.getAllAvailableNetworks();

    return all.filter((n) => {
      return (
        !isDefaultAddress(Core.getNetworkAddress(n, 'TOP_UP_PROXY_ADDRESS')) &&
        !isDefaultAddress(Core.getNetworkAddress(n, 'TOP_UP_EXCHANGE_PROXY_ADDRESS'))
      );
    });
  }

  public async convertTokenToEUR(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellAmount: string,
    network: Network,
  ): Promise<ConvertEURData> {
    this.#common.assertInitialized();

    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getSwapTargetForTopUp(network);

    try {
      return await this.#swapService.convertTokenToEURForTopUpExternal(
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
    this.#common.assertInitialized();

    const topupProxyAddress = Core.getNetworkAddress(network, TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY);

    const usdc = Core.getSwapTargetForTopUp(network);

    try {
      return await this.#swapService.convertEURToTokenForTopUpExternal(
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
    this.#common.assertInitialized();

    try {
      return (
        await this.#estimationService.getTopUpEstimationExternal(network, this.options.apiKey)
      ).priceInWei;
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
    this.#common.assertInitialized();

    this.#common.sendAudit({
      data: {
        transferData,
        tokenAmount,
        tokenAddress,
        network: tokenNetwork,
      },
      address: senderAddress as Address,
      apikey: this.options.apiKey,
    });

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

      const tagHash = await this.#tagService.getTagTopUpCodeExternal(tag, this.options.apiKey);

      if (config === undefined) {
        config = {};
      }

      const inputAsset = await this.#assetService.getFullTokenDataWithPriceExternal(
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

      const settings = await this.#common.getServerSettings();

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

        const swapTargetPrices = await this.#assetService.getTokenPricesExternal(
          [{ address: swapTarget.address, network: swapTarget.network }],
          this.options.apiKey,
        );

        if (swapTargetPrices.length !== 1) {
          throw new HHError('Failed to get token price');
        }

        swapTargetPrice = swapTargetPrices[0].price;

        if (transferData === undefined) {
          transferData = convertData.transferData;
        }
      } else {
        transferData = undefined;
      }

      const walletInfo = createWalletInfoAdapter(
        senderAddress as Address,
        supportsSignTypedDataV4,
        publicClient,
      );

      const permit2Service = new Permit2OnChainService(walletInfo);

      const topupService = new CardTopUpOnChainService({
        permitService: this.#permitService,
        approvalService: this.#approvalService,
        permit2Service,
        walletInfo,
      });

      await topupService.topUpCompound(
        senderAddress as Address,
        publicClient,
        createWalletClientAdapter(walletClient),
        inputAsset,
        tokenAmount,
        swapTargetPrice,
        transferData,
        tagHash,
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
            this.#common.sendAudit({
              data: payload,
              apikey: this.options.apiKey,
              address: senderAddress as Address,
            });
          },
        },
      );
    } catch (error) {
      if (error instanceof HolyheldSDKError) {
        throw error;
      }

      if (error instanceof ExpectedError && error.getCode() === 'userRejectSign') {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UserRejectedSignature,
          'User rejected the signature request',
          error,
        );
      }

      if (error instanceof ExpectedError && error.getCode() === 'userRejectTransaction') {
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
