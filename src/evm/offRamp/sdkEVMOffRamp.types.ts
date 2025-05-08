import type { TransferDataEVM } from '@holyheld/web-app-shared/sdklib/bundle';
import type { HolyheldSDKInterface, RequiredServiceList } from '../../sdk.types';
import type { SdkEVMInterface } from '../sdkEVM.types';

export interface SdkEVMOffRampOptions {
  common: HolyheldSDKInterface;
  commonEVM: SdkEVMInterface;
  services: RequiredServiceList<
    | 'txTagService'
    | 'permitService'
    | 'approvalService'
    | 'assetService'
    | 'swapService'
    | 'nonceService'
  >;
}

export type ConvertTopUpDataEVM = {
  transferData?: TransferDataEVM;
  tokenAmount: string;
  EURAmount: string;
};
