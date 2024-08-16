import {
  ExpectedError,
  HHAPIOnRampService,
  HHError,
  Network,
  UnexpectedError,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { Logger } from './logger';
import type { Address, WalletClient } from 'viem';
import { HolyheldSDKCommon, RequiredServiceList } from './types';
import { createPromise, createWalletClientAdapter } from './helpers';
import { HolyheldSDKError, HolyheldSDKErrorCode } from './errors';

export interface HolyheldOnRampSDKOptions {
  commonSDK: HolyheldSDKCommon;
  services: RequiredServiceList<'onRampService'>;
  apiKey: string;
  logger: Logger;
}

export class OnRampSDK {
  readonly #onRampService: HHAPIOnRampService;

  protected readonly logger: Logger;
  readonly #common: HolyheldSDKCommon;

  constructor(protected readonly options: HolyheldOnRampSDKOptions) {
    this.#onRampService = options.services.onRampService;

    this.logger = options.logger;
    this.#common = options.commonSDK;
  }

  public async requestOnRamp(
    walletClient: WalletClient,
    walletAddress: string,
    tokenAddress: string,
    tokenNetwork: Network,
    fiatAmount: string,
  ): Promise<string> {
    this.#common.assertInitialized();

    this.#common.sendAudit({
      data: {
        tokenAddress,
        tokenNetwork,
        fiatAmount,
        walletAddress,
      },
      address: walletAddress as Address,
      apikey: this.options.apiKey,
    });
    try {
      const token = await this.#common.getTokenByAddressAndNetwork(
        tokenAddress as Address,
        tokenNetwork,
      );

      const res = await this.#onRampService.requestExecute({
        walletClientAdapter: createWalletClientAdapter(walletClient),
        address: walletAddress as Address,
        token: token,
        fiatAmount: fiatAmount,
        apiKey: this.options.apiKey,
      });

      return res.requestId;
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
          HolyheldSDKErrorCode.FailedOnRampRequest,
          `OnRamp failed${error instanceof UnexpectedError ? ` with code ${error.getCode()}` : ''}`,
          error,
        );
      }

      throw error;
    }
  }

  public async watchRequestId(requestId: string, timeoutMs?: number): Promise<boolean> {
    this.#common.assertInitialized();

    const { reject, resolve, wait } = createPromise<boolean, string>();

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs) {
      timeout = setTimeout(() => {
        reject('watch request timeout');
      }, timeoutMs);
    }

    const interval = setInterval(async () => {
      const res = await this.#onRampService.requestStatus({
        requestId: requestId,
        apiKey: this.options.apiKey,
      });

      switch (res.status) {
        case 'APPROVED':
          resolve(true);
          break;
        case 'REJECTED':
          resolve(false);
          break;
        case 'NOT_RESOLVED':
        default:
          return;
      }
    }, 2_000);

    try {
      return await wait();
    } catch (error) {
      throw new HolyheldSDKError(
        HolyheldSDKErrorCode.FailedWatchOnRampRequest,
        `OnRamp failed${error instanceof UnexpectedError ? ` with code ${error.getCode()}` : ''}`,
        error,
      );
    } finally {
      clearInterval(interval);
      clearTimeout(timeout);
    }
  }
}
