import SDK, {
  HHAPINonceServiceExternal,
  type isEIP7702DelegateParams,
  type IsErc1271SignerParams,
  type EVMAddress,
  type PublicClientWithHoistedChain,
  type WalletInfoAdapter,
} from '@holyheld/web-app-shared/sdklib';

export function createWalletInfoAdapter(
  address: EVMAddress,
  publicClient: PublicClientWithHoistedChain,
  nonceService: HHAPINonceServiceExternal,
  _supportsSignTypedDataV4: boolean,
  _supportsRawTransactionsSigning: boolean,
): WalletInfoAdapter {
  return {
    supportsSignTypedDataV4: () => _supportsSignTypedDataV4,
    supportsRawTransactionsSigning: () => _supportsRawTransactionsSigning,
    async isErc1271Signer({ blockParams }: IsErc1271SignerParams): Promise<boolean> {
      if (address === undefined) {
        return false;
      }

      const code = await SDK.getCode(publicClient, address, blockParams);

      const [contract, delegate] = await Promise.all([
        SDK.isContract({
          by: 'code',
          code,
        }),
        SDK.isEIP7702Delegate({ by: 'code', code }).then((res) => res.delegate),
      ]);

      return contract && !delegate;
    },
    async isEIP7702Delegate({ blockParams }: isEIP7702DelegateParams): Promise<boolean> {
      if (address === undefined) {
        return false;
      }

      return SDK.isEIP7702Delegate({
        by: 'query',
        publicClient,
        address,
        blockParams,
      }).then((res) => res.delegate);
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
