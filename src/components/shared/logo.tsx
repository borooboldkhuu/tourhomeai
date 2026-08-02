import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";

/**
 * TourHome AI mark — a house inside a 360° orbit.
 * Same geometry as the PWA icons in /public/icons.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <rect width="40" height="40" rx="9" className="fill-foreground" />
      <ellipse
        cx="20" cy="22.5" rx="12" ry="5.4"
        className="stroke-background" strokeWidth="1.8" fill="none"
      />
      <path
        d="M20 9.5 L30 18.2 H27.4 V26.4 H22.9 V20.9 H17.1 V26.4 H12.6 V18.2 H10 Z"
        className="fill-background"
      />
    </svg>
  );
}

/** Mark plus wordmark, for headers and auth screens. */
export function Logo({
  className,
  showText = true,
  size = "default",
}: {
  className?: string;
  showText?: boolean;
  size?: "default" | "lg";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={size === "lg" ? "h-9 w-9" : "h-7 w-7"} />
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-[-0.02em]",
            size === "lg" ? "text-lg" : "text-[15px]",
          )}
        >
          {SITE.name}
        </span>
      )}
    </span>
  );
}
