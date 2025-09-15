import type { TransferDataSolana } from '@holyheld/web-app-shared/sdklib/bundle';
import type { HolyheldSDKInterface, RequiredServiceList } from '../../sdk.types';
import type { SdkSolanaInterface } from '../sdkSolana.types';

export interface SdkSolanaOffRampOptions {
  common: HolyheldSDKInterface;
  commonSolana: SdkSolanaInterface;
  services: RequiredServiceList<
    'txTagService' | 'approvalService' | 'assetService' | 'swapService' | 'tagService'
  >;
}

export type ConvertTopUpDataSolana = {
  transferData?: TransferDataSolana;
  tokenAmount: string;
  EURAmount: string;
};
