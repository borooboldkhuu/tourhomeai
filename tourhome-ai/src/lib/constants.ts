import type { PropertyStatus, PropertyType, LeadStatus } from "@/types/database.types";

export const SITE = {
  name: "TourHome AI",
  tagline: "Утаснаасаа 360° виртуал тур үүсгэ",
  description:
    "Үл хөдлөх хөрөнгийн зуучлагчдад зориулсан 360° виртуал тур үүсгэх платформ. Зураг оруулаад, хормын дотор дэлгэцэнд тохирсон танилцуулга хуудас, хуваалцах холбоос, QR код аваарай.",
} as const;

export const BUCKETS = {
  images: "property-images",
  panoramas: "property-panoramas",
  videos: "property-videos",
  avatars: "avatars",
} as const;

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Орон сууц",
  house: "Хувийн сууц",
  office: "Оффис",
  land: "Газар",
  commercial: "Худалдааны талбай",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Ноорог",
  published: "Нийтлэгдсэн",
  archived: "Архивласан",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Шинэ",
  contacted: "Холбогдсон",
  qualified: "Сонирхолтой",
  closed: "Хаагдсан",
  lost: "Татгалзсан",
};

export const AMENITIES = [
  "Лифт", "Дулаан гараж", "Хамгаалалт", "Тавилгатай", "Талбай харагдана",
  "Төв шугам", "Агааржуулалт", "Угаалгын өрөө 2", "Тагт", "Ойролцоо сургууль",
  "Ойролцоо цэцэрлэг", "Автомашины зогсоол",
] as const;

export const DISTRICTS = [
  "Баянзүрх", "Баянгол", "Сүхбаатар", "Чингэлтэй", "Хан-Уул",
  "Сонгинохайрхан", "Налайх", "Багануур", "Багахангай",
] as const;

export const DEFAULT_ROOM_PRESETS = [
  "Зочны өрөө", "Гал тогоо", "Унтлагын өрөө", "Хүүхдийн өрөө",
  "Угаалгын өрөө", "Тагт", "Коридор",
] as const;

/* ------------------------------------------------------------- billing -- */

export type PlanId = "trial" | "m1" | "m3" | "m12";

export interface Plan {
  id: PlanId;
  months: number;
  price: number;
  name: string;
  badge?: string;
  tagline: string;
  popular?: boolean;
  perMonth?: number;
  saveText?: string;
}

export const PLANS: Plan[] = [
  {
    id: "m1", months: 1, price: 49_999, name: "1 сар",
    tagline: "Хэрэгцээгээрээ сунгах",
    perMonth: 49_999,
  },
  {
    id: "m3", months: 3, price: 99_999, name: "3 сар", badge: "⭐",
    tagline: "Хамгийн их сонгогддог",
    popular: true, perMonth: 33_333, saveText: "33% хэмнэлт",
  },
  {
    id: "m12", months: 12, price: 299_999, name: "12 сар", badge: "💎",
    tagline: "Жилийн турш тасралтгүй",
    perMonth: 25_000, saveText: "50% хэмнэлт",
  },
];

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, Plan>;

/** How many properties an agent may publish before paying. */
export const TRIAL_PUBLISH_LIMIT = 1;

/** Days a free trial listing stays visible — must match public.trial_window(). */
export const TRIAL_DAYS = 7;

export const BANK = {
  name: "Хаан банк",
  account: "5000-1234-5678",
  holder: "Аялуун Проперти ХХК",
} as const;

export const MAX_IMAGE_MB = 25;
export const MAX_PANORAMA_MB = 50;
export const MAX_VIDEO_MB = 200;
