import BigNumber from 'bignumber.js';
import {
  pad,
  parseUnits,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import type { TransferData } from '@holyheld/web-app-shared/sdklib/bundle';
import Core, {
  CardTopUpOnChainService,
  CardTopUpOnChainServiceV2,
  ExpectedError,
  HHAPIApprovalService,
  HHAPIAssetsService,
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
import type { HolyheldSDKCommon, RequiredServiceList } from './types';
import {
  EURO_LIMIT_FOR_TEST_HOLYTAG,
  TEST_HOLYTAG,
  TOP_UP_EXCHANGE_PROXY_ADDRESS_KEY,
} from './constants';
import { createWalletClientAdapter } from './helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';
import { createWalletInfoAdapter } from './helpers';

export interface HolyheldOffRampSDKOptions {
  commonSDK: HolyheldSDKCommon;
  services: RequiredServiceList<
    'tagService' | 'permitService' | 'approvalService' | 'assetService' | 'swapService'
  >;
  apiKey: string;
}

export type TagInfoForTopUp = {
  found: boolean;
  avatarSrc?: string;
  tag?: string;
};

export type ConvertTopUpData = {
  transferData?: TransferData;
  tokenAmount: string;
  EURAmount: string;
};

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

  readonly #common: HolyheldSDKCommon;

  constructor(protected readonly options: HolyheldOffRampSDKOptions) {
    this.#permitService = options.services.permitService;
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#tagService = options.services.tagService;

    this.#common = options.commonSDK;
  }

  public async getTagInfoForTopUp(tag: string): Promise<TagInfoForTopUp> {
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

    return all.filter((network) => {
      return (
        !isDefaultAddress(Core.getNetworkAddress(network, 'TOP_UP_PROXY_ADDRESS')) &&
        !isDefaultAddress(Core.getNetworkAddress(network, 'TOP_UP_EXCHANGE_PROXY_ADDRESS'))
      );
    });
  }

  public async convertTokenToEUR(
    sellTokenAddress: string,
    sellTokenDecimals: number,
    sellAmount: string,
    network: Network,
  ): Promise<ConvertTopUpData> {
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
  ): Promise<ConvertTopUpData> {
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

  public async getTopUpEstimation(
    publicClient: PublicClient<Transport, Chain>,
    network: Network,
    amount: string,
    senderAddress: string,
    supportsSignTypedDataV4: boolean = false,
  ): Promise<string> {
    this.#common.assertInitialized();

    try {
      const networkInfo = this.#common.getNetwork(network);

      if (!networkInfo) {
        throw new HHError('Failed to get network info');
      }

      const walletInfo = createWalletInfoAdapter(
        senderAddress as Address,
        supportsSignTypedDataV4,
        publicClient,
      );

      const permit2Service = new Permit2OnChainService(walletInfo);
      const topupService = new CardTopUpOnChainServiceV2({
        approvalService: this.#approvalService,
        permitService: this.#permitService,
        permit2Service,
        walletInfo,
      });

      const swapTarget = Core.getSwapTargetForTopUp(network);

      const [token, convertData, swapTargetPrices] = await Promise.all([
        this.#assetService.getFullTokenDataWithPriceExternal(
          networkInfo.baseAsset.address,
          network,
          this.options.apiKey,
        ),
        this.convertTokenToEUR(
          networkInfo.baseAsset.address,
          networkInfo.baseAsset.decimals,
          amount,
          network,
        ),
        this.#assetService.getTokenPricesExternal(
          [{ address: swapTarget.address, network: swapTarget.network }],
          this.options.apiKey,
        ),
      ]);

      if (swapTargetPrices.length !== 1) {
        throw new HHError('Failed to get token price');
      }

      const allowanceFlow = await topupService.getAllowanceFlow({
        publicClient,
        senderAddress: senderAddress as Address,
        flowData: {
          flowType: 'topUp',
          amountInWei: parseUnits(amount, networkInfo.baseAsset.decimals),
          token,
          transferData: convertData.transferData,
          swapTargetPriceUSD: swapTargetPrices[0].price,
          receiverHash: pad('0x0', { dir: 'left', size: 32 }),
        },
      });

      if (allowanceFlow.flow !== 'executeWithPermit') {
        throw new HHError('Unexpected allowance flow', { payload: allowanceFlow });
      }

      return allowanceFlow.estimation.totalFee.toString();
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
      apiKey: this.options.apiKey,
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

      const isTestHolytag = tag.toLowerCase() === TEST_HOLYTAG.toLowerCase();

      if (
        !isTestHolytag &&
        new BigNumber(convertData.EURAmount).lt(
          new BigNumber(settings.external.minTopUpAmountInEUR).multipliedBy(new BigNumber(0.99)),
        )
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidTopUpAmount,
          `Minimum allowed amount is ${settings.external.minTopUpAmountInEUR} EUR`,
        );
      }

      const maxTopUpAmountInEUR = isTestHolytag
        ? EURO_LIMIT_FOR_TEST_HOLYTAG
        : settings.external.maxTopUpAmountInEUR;

      if (
        new BigNumber(convertData.EURAmount).gt(
          new BigNumber(maxTopUpAmountInEUR).multipliedBy(new BigNumber(1.01)),
        )
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidTopUpAmount,
          `Maximum allowed amount is ${maxTopUpAmountInEUR} EUR`,
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
              apiKey: this.options.apiKey,
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
