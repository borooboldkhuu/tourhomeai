import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Postgres-backed throttle for the public endpoints. No Redis, no extra
 * service — the counters live in `rate_limits` and expire on their own.
 * Fails open: if the database is unreachable we would rather accept a lead
 * than lose one.
 */
export async function allowRequest(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** Best-effort client address behind Vercel's proxy. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
