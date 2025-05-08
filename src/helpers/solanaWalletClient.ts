import type { Adapter } from '@solana/wallet-adapter-base';
import { Connection, SendOptions, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { HHError, WalletClientSolana } from '@holyheld/web-app-shared/sdklib/bundle';

export function createSolanaWalletClientFromAdapter(
  adapter: Adapter,
  connection: Connection,
): WalletClientSolana {
  return {
    async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
      if ('signTransaction' in adapter) {
        const signed = await adapter.signTransaction(transaction);

        if (signed instanceof VersionedTransaction) {
          return signed;
        }

        throw new HHError('Wallet returned a legacy Transaction, expected VersionedTransaction');
      }

      throw new HHError('signTransaction is not supported by this wallet');
    },

    async signAndSendTransaction(
      transaction: VersionedTransaction,
      sendOptions?: SendOptions,
    ): Promise<string> {
      return await adapter.sendTransaction(transaction, connection, sendOptions);
    },

    async signAllTransactions(
      transactions: VersionedTransaction[],
    ): Promise<VersionedTransaction[]> {
      if ('signAllTransactions' in adapter) {
        const signed = await adapter.signAllTransactions(transactions);

        const areAllVersioned = signed.every((tx) => tx instanceof VersionedTransaction);

        if (!areAllVersioned) {
          throw new HHError('Wallet returned legacy Transactions, expected VersionedTransaction');
        }

        return signed;
      }

      throw new HHError('signAllTransactions is not supported by this wallet');
    },

    async signMessage(message: string): Promise<string> {
      if ('signMessage' in adapter) {
        const encodedMessage =
          typeof message === 'string' ? new TextEncoder().encode(message) : message;

        const signature = await adapter.signMessage(encodedMessage);

        return bs58.encode(signature);
      }

      throw new HHError('signMessage is not supported by this wallet');
    },
  };
}
