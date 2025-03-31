import Core, {
  type Authorizer,
  type AuthorizerHeaders,
} from '@holyheld/web-app-shared/sdklib/bundle';

export const getAuthorizer = (apiKey: string, headers: AuthorizerHeaders = {}): Authorizer => {
  return {
    getAccountUid() {
      return '';
    },
    getPrivateHeaders(): AuthorizerHeaders {
      return Core.getExternalAuthHeaders(apiKey);
    },
    getPublicHeaders(): AuthorizerHeaders {
      return headers;
    },
  };
};
