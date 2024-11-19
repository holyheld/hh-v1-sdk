import type { WalletClient, Transport, Chain, Account } from 'viem';
import type {
  WalletClientAdapter,
  WalletClientExecutor,
} from '@holyheld/web-app-shared/sdklib/bundle';
import { HHError } from '@holyheld/web-app-shared/sdklib/bundle';

export const createWalletClientAdapter = (client: WalletClient | null): WalletClientAdapter => {
  return {
    useWalletClient(): WalletClientExecutor {
      return async (executor) => {
        if (client === null) {
          throw new HHError('Empty wallet client received');
        }

        return executor(client as WalletClient<Transport, Chain, Account>);
      };
    },
  };
};
