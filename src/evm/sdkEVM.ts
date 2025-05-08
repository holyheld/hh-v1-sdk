import type {
  NetworkInfoEVM,
  TokenEVM,
  WithPermitData,
} from '@holyheld/web-app-shared/sdklib/bundle';
import Core, {
  HHAPIOnRampServiceExternal,
  HHAPIApprovalServiceExternal,
  HHAPIAssetsServiceExternal,
  HHAPISwapServiceExternal,
  HHAPITxTagServiceExternal,
  HHAPINonceServiceExternal,
  HHError,
  Network,
  NetworkKind,
  PermitOnChainService,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { HolyheldSDKError, HolyheldSDKErrorCode } from '../errors';
import SdkEVMOffRamp from './offRamp/sdkEVMOffRamp';
import SdkEVMOnRamp from './onRamp/sdkEVMOnRamp';
import type { HolyheldSDKInterface, WalletBalancesEVM, WalletTokenEVM } from '../sdk.types';
import type { SdkEVMInterface, SdkEVMOptions } from './sdkEVM.types';

export default class SdkEVM implements SdkEVMInterface {
  readonly #txTagService: HHAPITxTagServiceExternal;
  readonly #permitService: PermitOnChainService;
  readonly #approvalService: HHAPIApprovalServiceExternal;
  readonly #assetService: HHAPIAssetsServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;
  readonly #onRampService: HHAPIOnRampServiceExternal;
  readonly #nonceService: HHAPINonceServiceExternal;

  readonly #common: HolyheldSDKInterface;

  readonly onRamp: SdkEVMOnRamp;
  readonly offRamp: SdkEVMOffRamp;

  constructor(protected readonly options: SdkEVMOptions) {
    this.#permitService = options.services.permitService;
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#txTagService = options.services.txTagService;
    this.#onRampService = options.services.onRampService;
    this.#nonceService = options.services.nonceService;

    this.#common = options.common;

    this.onRamp = new SdkEVMOnRamp({
      common: this.#common,
      commonEVM: this,
      services: {
        onRampService: this.#onRampService,
        swapService: this.#swapService,
      },
    });

    this.offRamp = new SdkEVMOffRamp({
      common: this.#common,
      commonEVM: this,
      services: {
        permitService: this.#permitService,
        txTagService: this.#txTagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
        swapService: this.#swapService,
        nonceService: this.#nonceService,
      },
    });
  }

  getAvailableNetworks(): Network[] {
    this.#common.assertInitialized();

    return Core.getAvailableNetworks();
  }

  isEVMNetwork(network: Network): boolean {
    this.#common.assertInitialized();

    return Core.isEVMNetwork(network);
  }

  getNetwork(network: Network): NetworkInfoEVM | undefined {
    this.#common.assertInitialized();

    return Core.getNetwork(network);
  }

  getNetworkChainId(network: Network): number {
    this.#common.assertInitialized();

    return Core.getChainId(network);
  }

  getNetworkByChainId(chainId: number): NetworkInfoEVM | undefined {
    this.#common.assertInitialized();

    return Core.getNetworkByChainId(chainId);
  }

  async getWalletBalances(address: string): Promise<WalletBalancesEVM> {
    this.#common.assertInitialized();

    try {
      const { tokens } = await this.#assetService.getMultiChainWalletTokens({
        address,
        networkKind: NetworkKind.EVM,
      });
      const availableNetworks = this.getAvailableNetworks();
      return {
        tokens: tokens.filter((item) =>
          availableNetworks.includes(item.network as Network),
        ) as WalletTokenEVM[],
      };
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

  async getTokenByAddressAndNetwork(address: string, network: Network): Promise<TokenEVM> {
    return (await this.#assetService.getTokenData({
      address,
      network,
    })) as WithPermitData<TokenEVM>;
  }
}
