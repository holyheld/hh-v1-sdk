import BigNumber from 'bignumber.js';
import Core, {
  ExpectedError,
  HHAPIOnRampServiceExternal,
  HHAPISwapServiceExternal,
  HHError,
  Network,
  UnexpectedError,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Address } from 'viem';
import { createPromise } from '../../helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from '../../errors';
import type {
  HolyheldSDKInterface,
  EstimateOnRampResult,
  WatchOnRampRequestIdOptions,
  WatchOnRampResult,
} from '../../sdk.types';
import type { SdkEVMInterface } from '../sdkEVM.types';
import type { RequestOnRampEVMResult, SdkEVMOnRampOptions } from './sdkEVMOnRamp.types';

const STATUS_CHECK_INTERVAL = 2_000;

export default class SdkEVMOnRamp {
  readonly #onRampService: HHAPIOnRampServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;

  readonly #common: HolyheldSDKInterface;
  readonly #commonEVM: SdkEVMInterface;

  constructor(protected readonly options: SdkEVMOnRampOptions) {
    this.#onRampService = options.services.onRampService;
    this.#swapService = options.services.swapService;

    this.#common = options.common;
    this.#commonEVM = options.commonEVM;
  }

  getAvailableNetworks(): Network[] {
    this.#common.assertInitialized();

    return this.#commonEVM
      .getAvailableNetworks()
      .filter((network) => Core.getSwapSourceForOnRamp(network) !== undefined);
  }

  async convertTokenToEUR(params: {
    tokenAddress: string;
    tokenNetwork: Network;
    amount: string;
  }): Promise<string> {
    this.#common.assertInitialized();

    try {
      const token = await this.#commonEVM.getTokenByAddressAndNetwork(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );

      const response = await this.#swapService.convertTokenToEURForOnRamp({
        token,
        tokenAmount: params.amount,
      });

      return response.fiatAmount;
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedConvertOnRampAmount,
        'Failed to convert token to EUR amount',
        error,
      );
    }
  }

  async convertEURToToken(params: {
    tokenAddress: string;
    tokenNetwork: Network;
    amount: string;
  }): Promise<string> {
    this.#common.assertInitialized();

    try {
      const token = await this.#commonEVM.getTokenByAddressAndNetwork(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );

      const response = await this.#swapService.convertEURToTokenForOnRamp({
        token,
        fiatAmount: params.amount,
      });

      return response.tokenAmount;
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedConvertOnRampAmount,
        'Failed to convert EUR to token amount',
        error,
      );
    }
  }

  async getOnRampEstimation(params: {
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: Network;
    EURAmount: string;
  }): Promise<EstimateOnRampResult> {
    this.#common.assertInitialized();

    try {
      const token = await this.#commonEVM.getTokenByAddressAndNetwork(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );

      const response = await this.#onRampService.estimate({
        token,
        amountEUR: params.EURAmount,
        beneficiaryAddress: params.walletAddress as Address,
      });

      return response;
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedOnRampEstimation,
        'Failed to estimate',
        error,
      );
    }
  }

  async requestOnRamp(params: {
    walletAddress: string;
    tokenAddress: string;
    tokenNetwork: Network;
    EURAmount: string;
  }): Promise<RequestOnRampEVMResult> {
    this.#common.assertInitialized();

    const operationId = `EVMOnRamp_${Math.random()}`;

    this.#common.sendAudit({
      data: {
        tokenAddress: params.tokenAddress,
        tokenNetwork: params.tokenNetwork,
        fiatAmount: params.EURAmount,
        walletAddress: params.walletAddress,
      },
      address: params.walletAddress as Address,
      operationId,
    });

    try {
      const settings = await this.#common.getServerSettings();

      if (new BigNumber(params.EURAmount).lt(settings.external.minOnRampAmountInEUR)) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidOnRampAmount,
          `Minimum allowed amount is ${settings.external.minOnRampAmountInEUR} EUR`,
        );
      }

      if (
        new BigNumber(params.EURAmount).gt(new BigNumber(settings.external.maxOnRampAmountInEUR))
      ) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidOnRampAmount,
          `Maximum allowed amount is ${settings.external.maxOnRampAmountInEUR} EUR`,
        );
      }

      const token = await this.#commonEVM.getTokenByAddressAndNetwork(
        params.tokenAddress as Address,
        params.tokenNetwork,
      );

      const response = await this.#onRampService.requestExecute({
        address: params.walletAddress as Address,
        token: token,
        fiatAmount: params.EURAmount,
      });

      return {
        amountEUR: response.amountEUR,
        amountToken: response.amountToken,
        beneficiaryAddress: response.beneficiaryAddress,
        chainId: response.chainId,
        feeEUR: response.feeEUR,
        token: token,
        requestUid: response.requestUid,
      };
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

      if (error instanceof HHError) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.FailedCreateOnRampRequest,
          `On-ramp failed${error instanceof UnexpectedError ? ` with code ${error.getCode()}` : ''}`,
          error,
        );
      }

      throw error;
    }
  }

  async watchRequestId(
    requestUid: string,
    options: WatchOnRampRequestIdOptions = {},
  ): Promise<WatchOnRampResult> {
    this.#common.assertInitialized();

    const { reject, resolve, wait } = createPromise<WatchOnRampResult, HolyheldSDKError>();

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout) {
      timeout = setTimeout(() => {
        reject(
          new HolyheldSDKError(
            HolyheldSDKErrorCode.FailedWatchOnRampRequestTimeout,
            'watch request timeout',
          ),
        );
      }, options.timeout);
    }

    const interval = setInterval(async () => {
      try {
        const response = await this.#onRampService.requestStatus({
          requestUid,
        });

        const result: WatchOnRampResult = { success: false };

        switch (response.status) {
          case 'success':
            if (response.txHash) {
              result.hash = response.txHash;
            }

            if (result.hash || !options.waitForTransactionHash) {
              result.success = true;
              resolve(result);
            }
            break;
          case 'declined':
            resolve(result);
            break;
          case 'failed':
            reject(
              new HolyheldSDKError(
                HolyheldSDKErrorCode.FailedOnRampRequest,
                response.reason,
              ).withPayload({ reason: response.reason }),
            );
            break;
          case 'not_approved':
          default:
            return;
        }
      } catch (e) {
        reject(
          new HolyheldSDKError(
            HolyheldSDKErrorCode.FailedWatchOnRampRequest,
            `Failed request on-ramp status`,
            e,
          ),
        );
        return;
      }
    }, STATUS_CHECK_INTERVAL);

    try {
      return await wait();
    } catch (error) {
      if (error instanceof HolyheldSDKError) {
        throw error;
      }
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedWatchOnRampRequest,
        `On-ramp failed${error instanceof UnexpectedError ? ` with code ${error.getCode()}` : ''}`,
        error,
      );
    } finally {
      clearInterval(interval);
      clearTimeout(timeout);
    }
  }
}
