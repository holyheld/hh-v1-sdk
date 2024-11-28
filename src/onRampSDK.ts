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

export type RequestResult = {
  requestUid: string;
  chainId: number;
  token: Token;
  amountEUR: string;
  amountToken: string;
  feeEUR: string;
  beneficiaryAddress: Address;
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
        apiKey: this.options.apiKey,
      });

      return response.fiatAmount;
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedConvertOnRampAmount,
        'Fail convert token to EUR amount',
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
        apiKey: this.options.apiKey,
      });

      return response.tokenAmount;
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedConvertOnRampAmount,
        'Fail convert EUR to token amount',
        error,
      );
    }
  }

  public async requestOnRamp(
    walletAddress: string,
    tokenAddress: string,
    tokenNetwork: Network,
    fiatAmount: string,
  ): Promise<RequestResult> {
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
        apiKey: this.options.apiKey,
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

  public async watchRequestId(requestUid: string, timeoutMs?: number): Promise<boolean> {
    this.#common.assertInitialized();

    const { reject, resolve, wait } = createPromise<boolean, HolyheldSDKError>();

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs) {
      timeout = setTimeout(() => {
        reject(
          new HolyheldSDKError(
            HolyheldSDKErrorCode.FailedWatchOnRampRequestTimeout,
            'watch request timeout',
          ),
        );
      }, timeoutMs);
    }

    const interval = setInterval(async () => {
      try {
        const response = await this.#onRampService.requestStatus({
          requestUid: requestUid,
          apiKey: this.options.apiKey,
        });

        switch (response.status) {
          case 'success':
            resolve(true);
            break;
          case 'declined':
            resolve(false);
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
