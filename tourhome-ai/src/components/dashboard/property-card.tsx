import Image from "next/image";
import Link from "next/link";
import { Eye, ImageOff, MapPin, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/database.types";

export function PropertyCard({ property, paused }: { property: Property; paused?: boolean }) {
  const variant = property.status === "published" ? "success" : property.status === "draft" ? "muted" : "outline";

  return (
    <Link href={`/dashboard/properties/${property.id}/edit`} className="group">
      <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-lg">
        <div className="relative aspect-[4/3] bg-muted">
          {property.cover_image_url ? (
            <Image
              src={property.cover_image_url}
              alt={property.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
          <Badge variant={variant} className="absolute left-3 top-3">
            {STATUS_LABELS[property.status]}
          </Badge>
          {paused && property.status === "published" && (
            <Badge variant="warning" className="absolute right-3 top-3">
              Түр зогссон
            </Badge>
          )}
        </div>

        <div className="space-y-2 p-5">
          <h3 className="truncate font-medium">{property.title}</h3>
          <p className="text-lg font-semibold tracking-tight">
            {formatPrice(property.price, property.currency)}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {property.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{property.location}</span>
            )}
            {property.area && (
              <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{property.area} м²</span>
            )}
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{property.view_count}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
