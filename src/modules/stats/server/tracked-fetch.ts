import { recordThirdPartyRequest } from "./stats-service";

export type ThirdPartyFetch = typeof fetch;

export function createTrackedThirdPartyFetch(fetcher: ThirdPartyFetch = fetch) {
  return async (...args: Parameters<ThirdPartyFetch>) => {
    const startedAt = performance.now();

    try {
      const response = await fetcher(...args);
      await recordThirdPartyRequest({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        ok: response.ok,
      });
      return response;
    } catch (error) {
      await recordThirdPartyRequest({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        ok: false,
      });
      throw error;
    }
  };
}

