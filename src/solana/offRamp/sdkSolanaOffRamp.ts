import type { Connection } from '@solana/web3.js';
import { pad, parseUnits } from 'viem';
import BigNumber from 'bignumber.js';
import Core, {
  HHAPIApprovalServiceExternal,
  HHAPIAssetsServiceExternal,
  HHAPISwapServiceExternal,
  HHAPITxTagServiceExternal,
  CardTopUpOnChainServiceSolana,
  isDefaultAddress,
  HHError,
  type BaseTopUpFlowSolana,
  type ExecuteFlowSolana,
  SolanaNetwork,
  TransferDataSolana,
  WithPrice,
  TokenSolana,
  WalletClientSolana,
  ExpectedError,
  UnexpectedError,
  HHAPITagServiceExternal,
} from '@holyheld/web-app-shared/sdklib/bundle';

import { HolyheldSDKError, HolyheldSDKErrorCode } from '../../errors';
import { EURO_LIMIT_FOR_TEST_HOLYTAG, TEST_HOLYTAG } from '../../constants';
import { TopUpStep, type HolyheldSDKInterface, type TopUpCallbackConfig } from '../../sdk.types';
import type { SdkSolanaInterface } from '../sdkSolana.types';
import type { ConvertTopUpDataSolana, SdkSolanaOffRampOptions } from './sdkSolanaOffRamp.types';

export default class SdkSolanaOffRamp {
  readonly #txTagService: HHAPITxTagServiceExternal;
  readonly #approvalService: HHAPIApprovalServiceExternal;
  readonly #assetService: HHAPIAssetsServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;
  readonly #tagService: HHAPITagServiceExternal;

  readonly #common: HolyheldSDKInterface;
  readonly #commonSolana: SdkSolanaInterface;

  constructor(protected readonly options: SdkSolanaOffRampOptions) {
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#txTagService = options.services.txTagService;
    this.#tagService = options.services.tagService;

    this.#common = options.common;
    this.#commonSolana = options.commonSolana;
  }

  getAvailableNetworks(): SolanaNetwork[] {
    this.#common.assertInitialized();

    return this.#commonSolana.getAvailableNetworks().filter((n) => {
      return !(
        isDefaultAddress(Core.getSolanaNetworkAddress(n, 'TOP_UP_PROGRAM_ADDRESS')) ||
        isDefaultAddress(Core.getSolanaNetworkAddress(n, 'TOP_UP_TREASURY_ADDRESS')) ||
        isDefaultAddress(Core.getSolanaNetworkAddress(n, 'TRANSFER_PROXY_ADDRESS'))
      );
    });
  }

  async convertTokenToEUR(params: {
    walletAddress: string;
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    network: SolanaNetwork;
  }): Promise<ConvertTopUpDataSolana> {
    this.#common.assertInitialized();

    const swapTarget = Core.getSwapTargetForTopUpSolana(params.network);

    try {
      return await this.#swapService.convertTokenToEURForTopUpSolana(
        swapTarget.address,
        swapTarget.decimals,
        params.tokenAddress,
        params.tokenDecimals,
        params.amount,
        params.walletAddress,
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
    walletAddress: string;
    tokenAddress: string;
    tokenDecimals: number;
    amount: string;
    network: SolanaNetwork;
  }): Promise<ConvertTopUpDataSolana> {
    this.#common.assertInitialized();

    const swapTarget = Core.getSwapTargetForTopUpSolana(params.network);

    try {
      return await this.#swapService.convertEURToTokenForTopUpSolana(
        swapTarget.address,
        swapTarget.decimals,
        params.tokenAddress,
        params.tokenDecimals,
        params.amount,
        params.walletAddress,
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

  async #estimate(params: {
    connection: Connection;
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: SolanaNetwork;
    tokenAmount: string;
    holytag?: string;
    transferData?: TransferDataSolana;
    eventConfig?: TopUpCallbackConfig;
    operationId?: string;
  }): Promise<ExecuteFlowSolana<BaseTopUpFlowSolana>> {
    const service = new CardTopUpOnChainServiceSolana({
      priorityFeeGetter: this.#assetService,
      addressChecker: this.#approvalService,
    });

    const token = (await this.#assetService.getFullTokenDataWithPrice({
      address: params.tokenAddress,
      network: params.tokenNetwork,
    })) as WithPrice<TokenSolana>;

    const convertData = await this.convertTokenToEUR({
      walletAddress: params.walletAddress,
      tokenAddress: token.address,
      tokenDecimals: token.decimals,
      amount: params.tokenAmount,
      network: params.tokenNetwork,
    });

    const settings = await this.#common.getServerSettings();

    const isTestHolytag =
      params.holytag !== undefined && params.holytag.toLowerCase() === TEST_HOLYTAG.toLowerCase();

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

    const swapTarget = Core.getSwapTargetForTopUpSolana(params.tokenNetwork);

    let swapTargetPriceUSD = '0';
    let transferData: TransferDataSolana | undefined = params.transferData;

    const isSwapTarget = Core.isSwapTargetForTopUpSolana(params.tokenAddress, params.tokenNetwork);
    const isSettlementToken = Core.isSettlementTokenForTopUpSolana(
      params.tokenAddress,
      params.tokenNetwork,
    );
    const isEURSettlementToken =
      isSettlementToken &&
      (Core.getSettlementTokensForTopUpSolana(params.tokenNetwork).find((st) =>
        Core.sameAddress(st.address, params.tokenAddress),
      )?.isEURStableCoin ??
        false);

    if (!isSwapTarget && !isEURSettlementToken) {
      const swapTarget = Core.getSwapTargetForTopUpSolana(params.tokenNetwork);

      swapTargetPriceUSD = (
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

    const receiverHash =
      params.holytag !== undefined
        ? await this.#txTagService.getTagTopUpCode({
            tag: params.holytag,
          })
        : pad('0x0', { dir: 'left', size: 32 });

    const flowData = await service.buildTopUp({
      connection: params.connection,
      flowData: {
        flowType: 'topUp',
        amountInLamports: parseUnits(params.tokenAmount, token.decimals),
        token,
        transferData,
        swapTarget,
        swapTargetPriceUSD,
        meta: { amountEUR: '0', amount: '0' },
        receiverHash,
        eventConfig: {
          onTransactionId: (hash: string) => {
            params.eventConfig?.onStepChange?.(TopUpStep.Sending);
            params.eventConfig?.onHashGenerate?.(hash);
            this.#common.sendAudit({
              data: {
                hash,
              },
              address: params.walletAddress,
              operationId: params.operationId,
            });
          },
          onTransactionExecuted: (hash: string) => {
            this.#common.sendAudit({
              data: {
                hash,
                state: 'success',
              },
              address: params.walletAddress,
              operationId: params.operationId,
            });
          },
        },
      },
      senderAddress: params.walletAddress,
    });

    params.eventConfig?.onStepChange?.(TopUpStep.Confirming);

    return service.estimateTopUp({
      connection: params.connection,
      senderAddress: params.walletAddress,
      flowData,
    });
  }

  async getTopUpEstimation(params: {
    connection: Connection;
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: SolanaNetwork;
    tokenAmount: string;
    holytag?: string;
    transferData?: TransferDataSolana;
  }): Promise<string> {
    this.#common.assertInitialized();

    try {
      const flowData = await this.#estimate({
        connection: params.connection,
        walletAddress: params.walletAddress,
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        tokenAmount: params.tokenAmount,
        transferData: params.transferData,
        holytag: params.holytag,
      });

      return flowData.estimation.totalFee.toString();
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
    connection: Connection;
    walletClient: WalletClientSolana;
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: SolanaNetwork;
    tokenAmount: string;
    transferData: TransferDataSolana | undefined;
    holytag: string;
    eventConfig?: TopUpCallbackConfig;
  }): Promise<string> {
    this.#common.assertInitialized();

    const operationId = `solanaOffRamp_${Math.random()}`;

    this.#common.sendAudit({
      data: {
        walletAddress: params.walletAddress,
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        tokenAmount: params.tokenAmount,
        transferData: params.transferData,
        holytag: params.holytag,
      },
      address: params.walletAddress,
      operationId,
    });

    try {
      const service = new CardTopUpOnChainServiceSolana({
        priorityFeeGetter: this.#assetService,
        addressChecker: this.#approvalService,
      });

      const flowData = await this.#estimate({
        connection: params.connection,
        walletAddress: params.walletAddress,
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        tokenAmount: params.tokenAmount,
        transferData: params.transferData,
        holytag: params.holytag,
        eventConfig: params.eventConfig,
        operationId,
      });

      this.#common.sendAudit({
        data: {
          ...flowData,
          eventConfig: undefined,
          amountInLamports: `${flowData.amountInLamports}`,
          estimation: {
            baseFees: `${flowData.estimation.baseFees}`,
            priorityFees: `${flowData.estimation.priorityFees}`,
            totalFee: `${flowData.estimation.totalFee}`,
          },
        },
        address: params.walletAddress,
        operationId,
      });

      return service.executeTopUp({
        flowData,
        connection: params.connection,
        senderAddress: params.walletAddress,
        walletClient: params.walletClient,
      });
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

  async topupSelf(params: {
    connection: Connection;
    walletClient: WalletClientSolana;
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: SolanaNetwork;
    tokenAmount: string;
    transferData: TransferDataSolana | undefined;
    eventConfig?: TopUpCallbackConfig;
  }): Promise<string> {
    this.#common.assertInitialized();

    const operationId = `solanaOffRamp_${Math.random()}`;

    this.#common.sendAudit({
      data: {
        walletAddress: params.walletAddress,
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        tokenAmount: params.tokenAmount,
        transferData: params.transferData,
      },
      address: params.walletAddress,
      operationId,
    });

    const info = await this.#tagService.validateAddress({ address: params.walletAddress });

    if (!info.isTopupAllowed) {
      throw new HolyheldSDKError(HolyheldSDKErrorCode.FailedTopUp, 'Top up not allowed');
    }

    try {
      const service = new CardTopUpOnChainServiceSolana({
        priorityFeeGetter: this.#assetService,
        addressChecker: this.#approvalService,
      });

      const flowData = await this.#estimate({
        connection: params.connection,
        walletAddress: params.walletAddress,
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        tokenAmount: params.tokenAmount,
        transferData: params.transferData,
        eventConfig: params.eventConfig,
        operationId,
      });

      this.#common.sendAudit({
        data: {
          ...flowData,
          eventConfig: undefined,
          amountInLamports: `${flowData.amountInLamports}`,
          estimation: {
            baseFees: `${flowData.estimation.baseFees}`,
            priorityFees: `${flowData.estimation.priorityFees}`,
            totalFee: `${flowData.estimation.totalFee}`,
          },
        },
        address: params.walletAddress,
        operationId,
      });

      return service.executeTopUp({
        flowData,
        connection: params.connection,
        senderAddress: params.walletAddress,
        walletClient: params.walletClient,
      });
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
