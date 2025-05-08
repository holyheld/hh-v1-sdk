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
import type {
  TokenEVM,
  TransferDataEVM,
  WithPermitData,
  WithPrice,
} from '@holyheld/web-app-shared/sdklib/bundle';
import Core, {
  CardTopUpOnChainService,
  CardTopUpOnChainServiceV2,
  ExpectedError,
  HHAPIApprovalServiceExternal,
  HHAPIAssetsServiceExternal,
  HHAPISwapServiceExternal,
  HHAPITxTagServiceExternal,
  HHAPINonceServiceExternal,
  HHError,
  Network,
  Permit2OnChainService,
  PermitOnChainService,
  TransactionState,
  TransactionStep,
  UnexpectedError,
  isDefaultAddress,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { HolyheldSDKInterface } from '../../sdk.types';
import { EURO_LIMIT_FOR_TEST_HOLYTAG, TEST_HOLYTAG } from '../../constants';
import { createWalletClientAdapter, createWalletInfoAdapter } from '../../helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from '../../errors';
import type { SdkEVMInterface } from '../sdkEVM.types';
import { type TopUpCallbackConfig, TopUpStep } from '../../sdk.types';
import { type ConvertTopUpDataEVM, type SdkEVMOffRampOptions } from './sdkEVMOffRamp.types';

export default class SdkEVMOffRamp {
  readonly #txTagService: HHAPITxTagServiceExternal;
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalServiceExternal;
  readonly #assetService: HHAPIAssetsServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;
  readonly #nonceService: HHAPINonceServiceExternal;

  readonly #common: HolyheldSDKInterface;
  readonly #commonEVM: SdkEVMInterface;

  constructor(protected readonly options: SdkEVMOffRampOptions) {
    this.#permitService = options.services.permitService;
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#txTagService = options.services.txTagService;
    this.#nonceService = options.services.nonceService;

    this.#common = options.common;
    this.#commonEVM = options.commonEVM;
  }

  getAvailableEVMNetworks(): Network[] {
    this.#common.assertInitialized();

    return this.#commonEVM.getAvailableNetworks().filter((network) => {
      return (
        !isDefaultAddress(Core.getNetworkAddress(network, 'TOP_UP_PROXY_ADDRESS')) &&
        !isDefaultAddress(Core.getNetworkAddress(network, 'TOP_UP_EXCHANGE_PROXY_ADDRESS'))
      );
    });
  }

  async convertTokenToEUR(params: {
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    network: Network;
  }): Promise<ConvertTopUpDataEVM> {
    this.#common.assertInitialized();

    const topupProxyAddress = Core.getNetworkAddress(
      params.network,
      'TOP_UP_EXCHANGE_PROXY_ADDRESS',
    );

    const swapTarget = Core.getSwapTargetForTopUp(params.network);

    try {
      return await this.#swapService.convertTokenToEURForTopUp(
        swapTarget.address,
        swapTarget.decimals,
        params.tokenAddress as Address,
        params.tokenDecimals,
        params.amount,
        topupProxyAddress,
        topupProxyAddress,
        params.network,
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

  async convertEURToToken(params: {
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    network: Network;
  }): Promise<ConvertTopUpDataEVM> {
    this.#common.assertInitialized();

    const topupProxyAddress = Core.getNetworkAddress(
      params.network,
      'TOP_UP_EXCHANGE_PROXY_ADDRESS',
    );

    const swapTarget = Core.getSwapTargetForTopUp(params.network);

    try {
      return await this.#swapService.convertEURToTokenForTopUp(
        swapTarget.address,
        swapTarget.decimals,
        params.tokenAddress as Address,
        params.tokenDecimals,
        params.amount,
        topupProxyAddress,
        topupProxyAddress,
        params.network,
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

  async getTopUpEstimation(params: {
    publicClient: PublicClient<Transport, Chain>;
    network: Network;
    amount: string;
    walletAddress: string;
    supportsSignTypedDataV4?: boolean;
    supportsRawTransactionsSigning?: boolean;
  }): Promise<string> {
    this.#common.assertInitialized();

    try {
      const networkInfo = this.#commonEVM.getNetwork(params.network);

      if (!networkInfo) {
        throw new HHError('Failed to get network info');
      }

      const walletInfo = createWalletInfoAdapter(
        params.walletAddress as Address,
        params.publicClient,
        this.#nonceService,
        !!params.supportsSignTypedDataV4,
        !!params.supportsRawTransactionsSigning,
      );

      const permit2Service = new Permit2OnChainService(walletInfo);
      const topupService = new CardTopUpOnChainServiceV2({
        approvalChecker: this.#approvalService,
        addressChecker: this.#approvalService,
        permitService: this.#permitService,
        permit2Service,
        walletInfo,
      });

      const swapTarget = Core.getSwapTargetForTopUp(params.network);

      const [token, swapTargetPrice, convertData] = await Promise.all([
        this.#assetService.getFullTokenDataWithPrice({
          address: networkInfo.baseAsset.address,
          network: params.network,
        }),
        this.#assetService.getFullTokenDataWithPrice({
          address: swapTarget.address,
          network: swapTarget.network,
        }),
        this.convertTokenToEUR({
          tokenAddress: networkInfo.baseAsset.address,
          tokenDecimals: networkInfo.baseAsset.decimals,
          amount: params.amount,
          network: params.network,
        }),
      ]);

      const allowanceFlow = await topupService.getAllowanceFlow({
        publicClient: params.publicClient,
        senderAddress: params.walletAddress as Address,
        flowData: {
          flowType: 'topUp',
          amountInWei: parseUnits(params.amount, networkInfo.baseAsset.decimals),
          token: token as WithPrice<WithPermitData<TokenEVM>>,
          transferData: convertData.transferData,
          swapTargetPriceUSD: swapTargetPrice.priceUSD,
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

  async topup(params: {
    publicClient: PublicClient<Transport, Chain>;
    walletClient: WalletClient;
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: Network;
    tokenAmount: string;
    transferData: TransferDataEVM | undefined;
    holytag: string;
    supportsSignTypedDataV4?: boolean;
    supportsRawTransactionsSigning?: boolean;
    eventConfig?: TopUpCallbackConfig;
  }): Promise<void> {
    this.#common.assertInitialized();

    const operationId = `EVMOffRamp_${Math.random()}`;

    this.#common.sendAudit({
      data: {
        transferData: params.transferData,
        tokenAmount: params.tokenAmount,
        tokenAddress: params.tokenAddress,
        network: params.tokenNetwork,
      },
      address: params.walletAddress as Address,
      operationId,
    });

    try {
      const chainId = await params.walletClient.getChainId();
      const walletNetwork = Core.getNetworkByChainId(chainId);

      if (walletNetwork === undefined) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UnsupportedNetwork,
          `Unsupported chain id: ${chainId}`,
        );
      }

      if (walletNetwork.network !== params.tokenNetwork) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.UnexpectedWalletNetwork,
          'Wallet network must match the token network',
        );
      }

      const tagHash = await this.#txTagService.getTagTopUpCode({ tag: params.holytag });

      const inputAsset = await this.#assetService.getFullTokenDataWithPrice({
        address: params.tokenAddress as Address,
        network: params.tokenNetwork,
      });

      const convertData = await this.convertTokenToEUR({
        tokenAddress: inputAsset.address,
        tokenDecimals: inputAsset.decimals,
        amount: params.tokenAmount,
        network: params.tokenNetwork,
      });

      const settings = await this.#common.getServerSettings();

      const isTestHolytag = params.holytag.toLowerCase() === TEST_HOLYTAG.toLowerCase();

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
      let transferData: TransferDataEVM | undefined = params.transferData;

      const isSwapTarget = Core.isSwapTargetForTopUp(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );
      const isSettlementToken = Core.isSettlementTokenForTopUp(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );
      const isEURSettlementToken =
        isSettlementToken &&
        (Core.getSettlementTokensForTopUp(params.tokenNetwork).find((st) =>
          Core.sameAddress(st.address, params.tokenAddress),
        )?.isEURStableCoin ??
          false);

      if (!isSwapTarget && !isEURSettlementToken) {
        const swapTarget = Core.getSwapTargetForTopUp(params.tokenNetwork);

        swapTargetPrice = (
          await this.#assetService.getFullTokenDataWithPrice({
            address: swapTarget.address,
            network: swapTarget.network,
          })
        ).priceUSD;

        if (transferData === undefined) {
          transferData = convertData.transferData;
        }
      } else {
        transferData = undefined;
      }

      const walletInfo = createWalletInfoAdapter(
        params.walletAddress as Address,
        params.publicClient,
        this.#nonceService,
        !!params.supportsSignTypedDataV4,
        !!params.supportsRawTransactionsSigning,
      );

      const permit2Service = new Permit2OnChainService(walletInfo);

      const topupService = new CardTopUpOnChainService({
        approvalChecker: this.#approvalService,
        addressChecker: this.#approvalService,
        permitService: this.#permitService,
        permit2Service,
        walletInfo,
      });

      await topupService.topUpCompound(
        params.walletAddress as Address,
        params.publicClient,
        createWalletClientAdapter(params.walletClient),
        inputAsset as WithPrice<WithPermitData<TokenEVM>>,
        params.tokenAmount,
        swapTargetPrice,
        transferData,
        tagHash,
        {
          onTransactionHash: (hash: string) => {
            params.eventConfig?.onHashGenerate?.(hash);
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

                params.eventConfig?.onStepChange?.(value);
              }
            },
          },
          onCallData: async (payload) => {
            this.#common.sendAudit({
              data: payload,
              address: params.walletAddress as Address,
              operationId,
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
