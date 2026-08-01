import { Skeleton } from "@/components/ui/skeleton";

export default function TourLoading() {
  return (
    <div className="min-h-screen">
      <Skeleton className="h-[70vh] w-full rounded-none sm:h-[80vh]" />
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    </div>
  );
}
