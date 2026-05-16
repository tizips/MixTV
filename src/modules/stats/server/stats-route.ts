import { recordApiRequest, recordPageDuration, recordPageVisit } from "./stats-service";

function isResponseLike(value: unknown): value is Response {
  return Boolean(value) && typeof value === "object" && "status" in (value as Record<string, unknown>);
}

export function withApiTraffic<TArgs extends unknown[], TResult extends Response>(
  handler: (...args: TArgs) => Promise<TResult> | TResult,
) {
  return async (...args: TArgs) => {
    const startedAt = performance.now();

    try {
      const response = await handler(...args);
      await recordApiRequest({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        ok: isResponseLike(response) ? response.status < 400 : true,
      });
      return response;
    } catch (error) {
      await recordApiRequest({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        ok: false,
      });
      throw error;
    }
  };
}

export async function recordPageVisitBeacon() {
  await recordPageVisit();
}

export async function recordPageDurationBeacon(durationMs?: number) {
  await recordPageDuration({ durationMs });
}
