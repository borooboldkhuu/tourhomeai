// Generated-style typing for the TourHome AI schema.
// Regenerate with: npx supabase gen types typescript --project-id <id> > src/types/database.types.ts

export type UserRole = "agent" | "company" | "admin";
export type PropertyStatus = "draft" | "published" | "archived";
export type PropertyType = "apartment" | "house" | "office" | "land" | "commercial";
export type ImageKind = "photo" | "panorama" | "floorplan" | "cover";
export type LeadStatus = "new" | "contacted" | "qualified" | "closed" | "lost";
export type PlanId = "trial" | "m1" | "m3" | "m12";
export type PaymentStatus = "pending" | "paid" | "failed" | "canceled" | "expired";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  plan: PlanId;
  plan_expires_at: string | null;
  trial_used: boolean;
  trial_property_id: string | null;
  trial_started_at: string | null;
  plan_note: string | null;
  created_at: string;
  updated_at: string;
}

export type Property = {
  id: string;
  agent_id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  location: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  area: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  total_floors: number | null;
  year_built: number | null;
  property_type: PropertyType;
  status: PropertyStatus;
  cover_image_url: string | null;
  video_url: string | null;
  amenities: string[];
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PropertyImage = {
  id: string;
  property_id: string;
  url: string;
  storage_path: string;
  kind: ImageKind;
  caption: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
}

export type TourHotspot = {
  pitch: number;
  yaw: number;
  text: string;
  sceneId?: string;
  type: "scene" | "info";
}

export type PropertyTour = {
  id: string;
  property_id: string;
  scene_key: string;
  room_name: string;
  panorama_url: string;
  storage_path: string | null;
  preview_url: string | null;
  hfov: number;
  pitch: number;
  yaw: number;
  hotspots: TourHotspot[];
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export type Lead = {
  id: string;
  property_id: string;
  agent_id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
  created_at: string;
}

export type AnalyticsEvent = {
  id: number;
  property_id: string;
  agent_id: string;
  event_type: string;
  scene_key: string | null;
  referrer: string | null;
  country: string | null;
  device: string | null;
  session_id: string | null;
  created_at: string;
}

/** Property joined with its media — used by the public tour page. */
export type PropertyWithMedia = Property & {
  property_images: PropertyImage[];
  property_tours: PropertyTour[];
  users: Pick<UserProfile, "id" | "full_name" | "phone" | "email" | "avatar_url" | "company_name"> | null;
};

export type Payment = {
  id: string;
  user_id: string;
  plan: PlanId;
  amount_minor: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  payment_intent_id: string | null;
  checkout_session_id: string | null;
  checkout_url: string | null;
  livemode: boolean;
  paid_at: string | null;
  months_granted: number | null;
  plan_expires_at: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

export type WebhookEvent = {
  id: string;
  type: string;
  received_at: string;
  payload: Record<string, unknown> | null;
};

/** Relationship metadata mirrors the foreign keys declared in supabase/schema.sql. */
export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: Partial<UserProfile> & { id: string; email: string };
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      properties: {
        Row: Property;
        Insert: Partial<Property> & { agent_id: string; slug: string; title: string };
        Update: Partial<Property>;
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      property_images: {
        Row: PropertyImage;
        Insert: Partial<PropertyImage> & { property_id: string; url: string; storage_path: string };
        Update: Partial<PropertyImage>;
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_tours: {
        Row: PropertyTour;
        Insert: Partial<PropertyTour> & {
          property_id: string;
          scene_key: string;
          room_name: string;
          panorama_url: string;
        };
        Update: Partial<PropertyTour>;
        Relationships: [
          {
            foreignKeyName: "property_tours_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: Lead;
        Insert: Partial<Lead> & { property_id: string; name: string; phone: string };
        Update: Partial<Lead>;
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & { user_id: string; plan: PlanId; amount_minor: number };
        Update: Partial<Payment>;
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: WebhookEvent;
        Insert: Partial<WebhookEvent> & { id: string; type: string };
        Update: Partial<WebhookEvent>;
        Relationships: [];
      };
      analytics: {
        Row: AnalyticsEvent;
        Insert: Partial<AnalyticsEvent> & { property_id: string };
        Update: Partial<AnalyticsEvent>;
        Relationships: [
          {
            foreignKeyName: "analytics_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      property_stats: {
        Row: {
          property_id: string;
          agent_id: string;
          title: string;
          slug: string;
          status: PropertyStatus;
          view_count: number;
          lead_count: number;
          views_7d: number;
          views_30d: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      increment_property_view: {
        Args: { p_slug: string };
        Returns: undefined;
      };
      can_publish: {
        Args: { p_agent: string };
        Returns: boolean;
      };
      apply_payment: {
        Args: { p_payment_intent: string };
        Returns: string | null;
      };
      deactivate_expired: {
        Args: { p_grace_days?: number };
        Returns: number;
      };
      has_access: {
        Args: { p_agent: string };
        Returns: boolean;
      };
      access_until: {
        Args: { p_agent: string };
        Returns: string | null;
      };
    };
    Enums: {
      plan_id: PlanId;
      payment_status: PaymentStatus;
      user_role: UserRole;
      property_status: PropertyStatus;
      property_type: PropertyType;
      image_kind: ImageKind;
      lead_status: LeadStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
