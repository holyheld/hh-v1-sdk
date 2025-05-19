import { TokenEVM } from '@holyheld/web-app-shared/sdklib/bundle';
import { HolyheldSDKInterface, RequiredServiceList } from '../../sdk.types';
import { SdkEVMInterface } from '../sdkEVM.types';
import { Address } from 'viem';

export interface SdkEVMOnRampOptions {
  common: HolyheldSDKInterface;
  commonEVM: SdkEVMInterface;
  services: RequiredServiceList<'onRampService' | 'swapService'>;
}

export type RequestOnRampEVMResult = {
  requestUid: string;
  chainId: number;
  token: TokenEVM;
  amountEUR: string;
  amountToken: string;
  feeEUR: string;
  beneficiaryAddress: Address;
};
