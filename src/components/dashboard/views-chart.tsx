"use client";

/** Dependency-free bar chart — keeps the bundle small and the look Apple-plain. */
export function ViewsChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {data.map((d) => (
          <div key={d.date} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-foreground/80 transition-all group-hover:bg-foreground"
              style={{ height: `${Math.max(2, (d.count / max) * 160)}px` }}
            />
            <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              {d.date.slice(5)} · {d.count}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
