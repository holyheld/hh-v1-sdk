import type { Address } from 'viem';
import {
  isContract,
  PublicClientWithHoistedChain,
  WalletInfoAdapter,
} from '@holyheld/web-app-shared/sdklib/bundle';

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
