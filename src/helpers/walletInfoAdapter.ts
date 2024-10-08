import type { PublicClientWithHoistedChain } from '@holyheld/web-app-shared/lib/helpers/viem-types';
import { isContract } from '@holyheld/web-app-shared/lib/services/onchain/v2/account-abstraction-wallets/isContract';
import type { WalletInfoAdapter } from '@holyheld/web-app-shared/lib/services/onchain/v2/utils/walletInfoAdapter';
import type { Address } from 'viem';

export function createWalletInfoAdapter(
  address: Address,
  _supportsSignTypedDataV4: boolean,
  publicClient: PublicClientWithHoistedChain,
): WalletInfoAdapter {
  return {
    async isErc1271Signer(): Promise<boolean> {
      if (address === undefined) {
        return false;
      }

      if (await isContract(publicClient, address)) {
        return true;
      }

      return false;
    },
    supportsSignTypedDataV4(): boolean {
      return _supportsSignTypedDataV4;
    },
  };
}
