export enum HolyheldSDKErrorCode {
  NotInitialized = 'HSDK_NI',
  FailedInitialization = 'HSDK_FI',
  UnsupportedNetwork = 'HSDK_UN',
  InvalidTopUpAmount = 'HSDK_ITUA',
  InvalidOnRampAmount = 'HSDK_IORA',
  UnexpectedWalletNetwork = 'HSDK_UWN',
  UserRejectedSignature = 'HSDK_RS',
  UserRejectedTransaction = 'HSDK_RT',
  FailedSettings = 'HSDK_FS',
  FailedTagInfo = 'HSDK_FTI',
  FailedAddressInfo = 'HSDK_FAI',
  FailedWalletBalances = 'HSDK_FWB',
  FailedEstimation = 'HSDK_FE',
  FailedConversion = 'HSDK_FC',
  FailedTopUp = 'HSDK_FTU',
  FailedCreateOnRampRequest = 'HSDK_FCOR',
  FailedOnRampRequest = 'HSDK_FOR',
  FailedWatchOnRampRequestTimeout = 'HSDK_FwORT',
  FailedWatchOnRampRequest = 'HSDK_FWORR',
  FailedConvertOnRampAmount = 'HSDK_FCORA',
  FailedOnRampEstimation = 'HSDK_FORE',
}

export class HolyheldSDKError extends Error {
  code: HolyheldSDKErrorCode;
  payload: Record<string, unknown> = {};

  constructor(code: HolyheldSDKErrorCode, message: string, cause?: unknown) {
    super(`HolyheldSDKError with code ${code}: ${message}`, { cause });
    this.code = code;
  }

  withPayload(payload: Record<string, unknown>): HolyheldSDKError {
    this.payload = payload;
    return this;
  }
}
