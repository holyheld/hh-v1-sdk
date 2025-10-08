import Core, {
  HHAPIApprovalServiceExternal,
  HHAPIAssetsServiceExternal,
  HHAPISwapServiceExternal,
  HHAPITxTagServiceExternal,
  HHAPITagServiceExternal,
  HHError,
  SolanaNetwork,
  NetworkKind,
  type NetworkInfoSolana,
  type TokenSolana,
  type SolanaAddress,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { HolyheldSDKError, HolyheldSDKErrorCode } from '../errors';
import type { HolyheldSDKInterface, WalletBalancesSolana, WalletTokenSolana } from '../sdk.types';
import type { SdkSolanaInterface, SdkSolanaOptions } from './sdkSolana.types';
import SdkSolanaOffRamp from './offRamp/sdkSolanaOffRamp';

export default class SdkSolana implements SdkSolanaInterface {
  readonly #approvalService: HHAPIApprovalServiceExternal;
  readonly #assetService: HHAPIAssetsServiceExternal;
  readonly #swapService: HHAPISwapServiceExternal;
  readonly #txTagService: HHAPITxTagServiceExternal;
  readonly #tagService: HHAPITagServiceExternal;

  readonly #common: HolyheldSDKInterface;

  readonly offRamp: SdkSolanaOffRamp;

  constructor(protected readonly options: SdkSolanaOptions) {
    this.#approvalService = options.services.approvalService;
    this.#assetService = options.services.assetService;
    this.#swapService = options.services.swapService;
    this.#txTagService = options.services.txTagService;
    this.#tagService = options.services.tagService;

    this.#common = options.common;

    this.offRamp = new SdkSolanaOffRamp({
      common: this.#common,
      commonSolana: this,
      services: {
        tagService: this.#tagService,
        txTagService: this.#txTagService,
        approvalService: this.#approvalService,
        assetService: this.#assetService,
        swapService: this.#swapService,
      },
    });
  }

  getAvailableNetworks(): SolanaNetwork[] {
    this.#common.assertInitialized();

    return Core.getAvailableNetworksSolana();
  }

  isSolanaNetwork(network: SolanaNetwork): boolean {
    this.#common.assertInitialized();

    return Core.isSolanaNetwork(network);
  }

  getNetwork(network: SolanaNetwork): NetworkInfoSolana | undefined {
    this.#common.assertInitialized();

    return Core.getSolanaNetwork(network);
  }

  async getWalletBalances(address: string): Promise<WalletBalancesSolana> {
    this.#common.assertInitialized();

    try {
      const { tokens } = await this.#assetService.getMultiChainWalletTokens({
        address: address as SolanaAddress,
        networkKind: NetworkKind.Solana,
      });
      const availableNetworks = this.getAvailableNetworks();
      return {
        tokens: tokens.filter((item) =>
          availableNetworks.includes(item.network as SolanaNetwork),
        ) as WalletTokenSolana[],
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

  async getTokenByAddressAndNetwork(address: string, network: SolanaNetwork): Promise<TokenSolana> {
    return (await this.#assetService.getTokenData({
      address: address as SolanaAddress,
      network,
    })) as TokenSolana;
  }
}
