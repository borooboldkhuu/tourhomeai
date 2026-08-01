import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Latin/Cyrillic-safe URL slug + short random suffix for uniqueness. */
export function slugify(input: string) {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",
    н:"n",о:"o",ө:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",
    щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  const base = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `tour-${suffix}`;
}

export function formatPrice(value: number, currency = "MNT") {
  if (currency === "MNT") {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} тэрбум ₮`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} сая ₮`;
    return `${new Intl.NumberFormat("mn-MN").format(value)} ₮`;
  }
  return new Intl.NumberFormat("mn-MN", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("mn-MN").format(value);
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(value));
}

export function pricePerSqm(price: number, area: number | null) {
  if (!area || area <= 0) return null;
  return Math.round(price / area);
}

export function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
