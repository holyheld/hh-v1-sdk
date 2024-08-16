type PromiseParts<ReturnType, RejectType = string> = {
  resolve?: (result: ReturnType) => void;
  reject?: (cause: RejectType) => void;
  wait?: () => Promise<ReturnType>;
};
export const createPromise = <ReturnType, RejectType = string>(): Required<
  PromiseParts<ReturnType, RejectType>
> => {
  const parts: PromiseParts<ReturnType, RejectType> = {};
  const promise = new Promise<ReturnType>((resolve, reject) => {
    parts.resolve = (result: ReturnType) => {
      resolve(result);
    };
    parts.reject = (cause: RejectType) => {
      reject(cause);
    };
  });

  parts.wait = async (): Promise<ReturnType> => {
    return await promise;
  };

  return parts as Required<PromiseParts<ReturnType, RejectType>>;
};
