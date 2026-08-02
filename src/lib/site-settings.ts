import { createClient } from "@/lib/supabase/server";
import type { PropertyTour } from "@/types/database.types";

export interface DemoRoom {
  key: string;
  name: string;
  url: string;
}

export const DEMO_SETTINGS_KEY = "landing_demo";

/** Panoramas bundled with the repo — used until an admin uploads their own. */
export const DEFAULT_DEMO_ROOMS: DemoRoom[] = [
  { key: "living", name: "Зочны өрөө", url: "/demo/living.jpg" },
  { key: "kitchen", name: "Гал тогоо", url: "/demo/kitchen.jpg" },
  { key: "bedroom", name: "Унтлагын өрөө", url: "/demo/bedroom.jpg" },
];

/** Rooms shown in the landing-page sample tour. */
export async function getDemoRooms(): Promise<DemoRoom[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", DEMO_SETTINGS_KEY)
      .maybeSingle();

    const rooms = (data?.value as { rooms?: DemoRoom[] } | null)?.rooms;
    if (Array.isArray(rooms) && rooms.length > 0) {
      return rooms.filter((r) => r?.url && r?.name);
    }
  } catch {
    // settings table not migrated yet — fall through to the bundled sample
  }
  return DEFAULT_DEMO_ROOMS;
}

/** Shapes the rooms into what the shared PanoramaViewer expects. */
export function toTours(rooms: DemoRoom[]): PropertyTour[] {
  return rooms.map((room, i) => ({
    id: `demo-${i}`,
    property_id: "demo",
    scene_key: room.key || `room-${i}`,
    room_name: room.name,
    panorama_url: room.url,
    storage_path: null,
    preview_url: null,
    hfov: 105,
    pitch: 0,
    yaw: i * 40,
    hotspots: [],
    sort_order: i,
    is_default: i === 0,
    created_at: new Date(0).toISOString(),
  }));
}
