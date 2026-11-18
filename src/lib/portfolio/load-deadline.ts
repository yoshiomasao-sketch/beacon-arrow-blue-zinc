/** Shared deadline for one file. A timeout is not a success. */

export type DeadlineResult<T> = { ok: true; value: T } | { ok: false; timeout: boolean };

export function loadPercent(done: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(done)) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Resolves when `task` settles, or when `ms` elapses.
 * A late result from `task` cannot replace the timeout.
 */
export function withDeadline<T>(task: Promise<T>, ms: number, onTimeout?: () => void): Promise<DeadlineResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DeadlineResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* aborting the file must not skip the timeout */
      }
      finish({ ok: false, timeout: true });
    }, ms);
    task.then(
      (value) => finish({ ok: true, value }),
      () => finish({ ok: false, timeout: false }),
    );
  });
}

export type HeaderCheck = "ok" | "fail" | "timeout";

function isAudioType(type: string): boolean {
  return type.startsWith("audio/") || type.includes("wave") || type.includes("wav") || type.includes("mpeg");
}

function looksLikeAudio(bytes: Uint8Array): boolean {
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;
  return false;
}

/**
 * Reads only the start of a file. A full download is cancelled.
 * Success means the response is audio, not that it was decoded.
 */
export async function confirmAudioHeader(url: string, ms: number, fetchImpl: typeof fetch = fetch): Promise<HeaderCheck> {
  const controller = new AbortController();
  const result = await withDeadline(
    fetchImpl(url, { headers: { Range: "bytes=0-63" }, signal: controller.signal }),
    ms,
    () => controller.abort(),
  );
  if (!result.ok) return result.timeout ? "timeout" : "fail";
  const response = result.value;
  if (!response.ok && response.status !== 206) return "fail";
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type.startsWith("text/") || type.includes("html")) {
    await response.body?.cancel().catch(() => undefined);
    return "fail";
  }
  if (isAudioType(type)) {
    await response.body?.cancel().catch(() => undefined);
    return "ok";
  }
  const reader = response.body?.getReader();
  if (!reader) return "fail";
  const first = await withDeadline(reader.read(), ms);
  await reader.cancel().catch(() => undefined);
  if (!first.ok || !first.value.value) return first.ok ? "fail" : first.timeout ? "timeout" : "fail";
  return looksLikeAudio(first.value.value) ? "ok" : "fail";
}
