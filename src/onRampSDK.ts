import BigNumber from 'bignumber.js';
import Core, {
  ExpectedError,
  HHAPIOnRampService,
  HHAPISwapService,
  HHError,
  Network,
  UnexpectedError,
  type Token,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Address } from 'viem';
import type { HolyheldSDKCommon, RequiredServiceList } from './types';
import { createPromise } from './helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';

const STATUS_CHECK_INTERVAL = 2_000;

export interface HolyheldOnRampSDKOptions {
  commonSDK: HolyheldSDKCommon;
  services: RequiredServiceList<'onRampService' | 'swapService'>;
  apiKey: string;
}

export type EstimateOnRampResult = {
  expectedAmount: string;
  feeAmount: string;
};

export type RequestOnRampResult = {
  requestUid: string;
  chainId: number;
  token: Token;
  amountEUR: string;
  amountToken: string;
  feeEUR: string;
  beneficiaryAddress: Address;
};

export type WatchOnRampResult = {
  success: boolean;
  hash?: string;
};

export type WatchOnRampRequestIdOptions = {
  timeout?: number;
  waitForTransactionHash?: boolean;
};

export default class OnRampSDK {
  readonly #onRampService: HHAPIOnRampService;
  readonly #swapService: HHAPISwapService;

  readonly #common: HolyheldSDKCommon;

  constructor(protected readonly options: HolyheldOnRampSDKOptions) {
    this.#onRampService = options.services.onRampService;
    this.#swapService = options.services.swapService;

    this.#common = options.commonSDK;
  }

  public getAvailableNetworks(): Network[] {
    return this.#common
      .getAllAvailableNetworks()
      .filter((network) => Core.getSwapSourceForOnRamp(network) !== undefined);
  }

  public async convertTokenToEUR(
    tokenAddress: string,
    tokenNetwork: Network,
    amount: string,
  ): Promise<string> {
    this.#common.assertInitialized();

    try {
      const token = await this.#common.getTokenByAddressAndNetwork(
        tokenAddress as Address,
        tokenNetwork,
      );

      const response = await this.#swapService.convertTokenToEURForOnRampExternal({
        token,
        tokenAmount: amount,
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

  public async convertEURToToken(
    tokenAddress: string,
    tokenNetwork: Network,
    amount: string,
  ): Promise<string> {
    this.#common.assertInitialized();

    try {
      const token = await this.#common.getTokenByAddressAndNetwork(
        tokenAddress as Address,
        tokenNetwork,
      );

      const response = await this.#swapService.convertEURToTokenForOnRampExternal({
        token,
        fiatAmount: amount,
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

  public async getOnRampEstimation(
    walletAddress: string,
    tokenAddress: string,
    tokenNetwork: Network,
    fiatAmount: string,
  ): Promise<EstimateOnRampResult> {
    this.#common.assertInitialized();

    try {
      const token = await this.#common.getTokenByAddressAndNetwork(
        tokenAddress as Address,
        tokenNetwork,
      );

      const response = await this.#onRampService.estimateExternal({
        token,
        amountEUR: fiatAmount,
        beneficiaryAddress: walletAddress as Address,
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

  public async requestOnRamp(
    walletAddress: string,
    tokenAddress: string,
    tokenNetwork: Network,
    fiatAmount: string,
  ): Promise<RequestOnRampResult> {
    this.#common.assertInitialized();

    this.#common.sendAudit({
      data: {
        tokenAddress,
        tokenNetwork,
        fiatAmount,
        walletAddress,
      },
      address: walletAddress as Address,
      apiKey: this.options.apiKey,
    });

    try {
      const settings = await this.#common.getServerSettings();

      if (new BigNumber(fiatAmount).lt(settings.external.minOnRampAmountInEUR)) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidOnRampAmount,
          `Minimum allowed amount is ${settings.external.minOnRampAmountInEUR} EUR`,
        );
      }

      if (new BigNumber(fiatAmount).gt(new BigNumber(settings.external.maxOnRampAmountInEUR))) {
        throw new HolyheldSDKError(
          HolyheldSDKErrorCode.InvalidOnRampAmount,
          `Maximum allowed amount is ${settings.external.maxOnRampAmountInEUR} EUR`,
        );
      }

      const token = await this.#common.getTokenByAddressAndNetwork(
        tokenAddress as Address,
        tokenNetwork,
      );

      const response = await this.#onRampService.requestExecute({
        address: walletAddress as Address,
        token: token,
        fiatAmount: fiatAmount,
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

  public async watchRequestId(
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
          requestUid: requestUid,
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
