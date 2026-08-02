import { PLAN_BY_ID, TRIAL_DAYS, tourLimitOf, type Plan } from "@/lib/constants";
import type { UserProfile } from "@/types/database.types";

export interface Entitlement {
  /** Paid subscription currently running. */
  active: boolean;
  /** Free trial window still open. */
  inTrial: boolean;
  /** Published tours are visible to the public right now. */
  toursLive: boolean;
  /** May the agent publish another listing? */
  canPublish: boolean;
  trialUsed: boolean;
  /** When the public tours go on hold. */
  accessUntil: Date | null;
  expiresAt: Date | null;
  daysLeft: number | null;
  plan: Plan | null;
  /** Published tours allowed at once — null means unlimited. */
  tourLimit: number | null;
  label: string;
}

const DAY = 86_400_000;

/** Mirrors `has_access()` / `enforce_publish_quota()` in the database. */
export function getEntitlement(profile: UserProfile): Entitlement {
  const now = Date.now();

  const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const active = !!expiresAt && expiresAt.getTime() > now;

  const trialEnds = profile.trial_started_at
    ? new Date(new Date(profile.trial_started_at).getTime() + TRIAL_DAYS * DAY)
    : null;
  const inTrial = !!trialEnds && trialEnds.getTime() > now;

  const candidates = [expiresAt, trialEnds].filter(Boolean) as Date[];
  const accessUntil = candidates.length
    ? new Date(Math.max(...candidates.map((d) => d.getTime())))
    : null;

  const toursLive = active || inTrial || (!profile.trial_used && !expiresAt);
  const plan = profile.plan !== "trial" ? PLAN_BY_ID[profile.plan] ?? null : null;
  const daysLeft = accessUntil && accessUntil.getTime() > now
    ? Math.max(0, Math.ceil((accessUntil.getTime() - now) / DAY))
    : null;

  const label = active
    ? `${plan?.name ?? "Багц"} · ${daysLeft} хоног үлдсэн`
    : inTrial
      ? `Үнэгүй туршилт · ${daysLeft} хоног үлдсэн`
      : profile.trial_used
        ? "Хугацаа дууссан — турууд түр зогссон"
        : `Үнэгүй туршилт — 1 зар, ${TRIAL_DAYS} хоног`;

  return {
    active,
    inTrial,
    toursLive,
    canPublish: active || !profile.trial_used,
    trialUsed: profile.trial_used,
    accessUntil,
    expiresAt,
    daysLeft,
    plan,
    tourLimit: active ? tourLimitOf(profile.plan) : 1,
    label,
  };
}

/** Turns the raw Postgres error into something an agent can act on. */
export function readableDbError(message: string): string {
  if (message.includes("TOURHOME_TRIAL_USED")) {
    return "Үнэгүй туршилтын 1 зараа аль хэдийн нийтэлсэн байна. Үргэлжлүүлэхийн тулд багц идэвхжүүлнэ үү.";
  }
  if (message.includes("TOURHOME_PLAN_LIMIT")) {
    return "Багцын тур хязгаарт хүрсэн байна. Хуучин зараа нийтлэлээс хасах, эсвэл дээд багц руу шилжинэ үү.";
  }
  return message;
}
