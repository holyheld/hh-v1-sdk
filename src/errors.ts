export enum HolyheldSDKErrorCode {
  UnsupportedNetwork = 'HSDK_UN',
  InvalidTopUpAmount = 'HSDK_ITUA',
  UnexpectedWalletNetwork = 'HSDK_UWN',
  UserRejectedSignature = 'HSDK_RS',
  UserRejectedTransaction = 'HSDK_RT',
  FailedSettings = 'HSDK_FS',
  FailedTagInfo = 'HSDK_FTI',
  FailedWalletBalances = 'HSDK_FWB',
  FailedEstimation = 'HSDK_FE',
  FailedConversion = 'HSDK_FC',
  FailedTopUp = 'HSDK_FTU',
}

export class HolyheldSDKError extends Error {
  code: HolyheldSDKErrorCode;

  constructor(code: HolyheldSDKErrorCode, message: string, cause?: unknown) {
    super(`HolyheldSDKError with code ${code}: ${message}`, { cause });
    this.code = code;
  }
}
