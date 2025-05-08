import {
  HHAPINonceServiceExternal,
  isContract,
  type PublicClientWithHoistedChain,
  type WalletInfoAdapter,
} from '@holyheld/web-app-shared/sdklib/bundle';
import type { Address } from 'viem';

export function createWalletInfoAdapter(
  address: Address,
  publicClient: PublicClientWithHoistedChain,
  nonceService: HHAPINonceServiceExternal,
  _supportsSignTypedDataV4: boolean,
  _supportsRawTransactionsSigning: boolean,
): WalletInfoAdapter {
  return {
    supportsSignTypedDataV4: () => _supportsSignTypedDataV4,
    supportsRawTransactionsSigning: () => _supportsRawTransactionsSigning,
    async isErc1271Signer(): Promise<boolean> {
      if (address === undefined) {
        return false;
      }

      if (await isContract(publicClient, address)) {
        return true;
      }

      return false;
    },
    async getOffchainPermit2Nonce({ address: senderAddress, network }) {
      try {
        return await nonceService.getNonce(senderAddress, network);
      } catch (error) {
        return 0n;
      }
    },
    async incrementPermit2Nonce({ address: senderAddress, network }): Promise<void> {
      try {
        return await nonceService.incrementNonce(senderAddress, network);
      } catch (error) {
        /* */
      }
    },
  };
}
