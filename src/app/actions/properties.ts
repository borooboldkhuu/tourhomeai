"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { propertySchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { BUCKETS } from "@/lib/constants";
import { readableDbError } from "@/lib/billing";
import type { ImageKind } from "@/types/database.types";

export type ActionState = { error?: string; success?: string; propertyId?: string } | null;

function parseForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : Number(v);
  };
  return propertySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price") ?? 0,
    currency: formData.get("currency") ?? "MNT",
    location: formData.get("location"),
    district: formData.get("district"),
    city: formData.get("city") ?? "Улаанбаатар",
    area: num("area"),
    rooms: num("rooms"),
    bathrooms: num("bathrooms"),
    floor: num("floor"),
    total_floors: num("total_floors"),
    year_built: num("year_built"),
    property_type: formData.get("property_type") ?? "apartment",
    status: formData.get("status") ?? "draft",
    video_url: formData.get("video_url"),
    amenities: formData.getAll("amenities").map(String),
  });
}

/** Create a property shell so media can be attached to a real id. */
export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const { data, error } = await supabase
    .from("properties")
    .insert({
      agent_id: user.id,
      slug: slugify(d.title),
      title: d.title,
      description: d.description || null,
      price: d.price,
      currency: d.currency,
      location: d.location || null,
      district: d.district || null,
      city: d.city || null,
      area: d.area ?? null,
      rooms: d.rooms ?? null,
      bathrooms: d.bathrooms ?? null,
      floor: d.floor ?? null,
      total_floors: d.total_floors ?? null,
      year_built: d.year_built ?? null,
      property_type: d.property_type,
      status: d.status,
      video_url: d.video_url || null,
      amenities: d.amenities,
      published_at: d.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { error: readableDbError(error.message) };

  revalidatePath("/dashboard/properties");
  redirect(`/dashboard/properties/${data.id}/edit?created=1`);
}

export async function updateProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const id = String(formData.get("id"));
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const { data: current } = await supabase
    .from("properties")
    .select("status, published_at")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("properties")
    .update({
      title: d.title,
      description: d.description || null,
      price: d.price,
      currency: d.currency,
      location: d.location || null,
      district: d.district || null,
      city: d.city || null,
      area: d.area ?? null,
      rooms: d.rooms ?? null,
      bathrooms: d.bathrooms ?? null,
      floor: d.floor ?? null,
      total_floors: d.total_floors ?? null,
      year_built: d.year_built ?? null,
      property_type: d.property_type,
      status: d.status,
      video_url: d.video_url || null,
      amenities: d.amenities,
      published_at:
        d.status === "published"
          ? current?.published_at ?? new Date().toISOString()
          : current?.published_at ?? null,
    })
    .eq("id", id)
    .eq("agent_id", user.id); // defence in depth on top of RLS

  if (error) return { error: readableDbError(error.message) };

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${id}/edit`);
  return { success: "Хадгаллаа", propertyId: id };
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Remove storage objects first (DB rows cascade).
  const { data: images } = await supabase.from("property_images").select("storage_path").eq("property_id", id);
  const { data: tours } = await supabase.from("property_tours").select("storage_path").eq("property_id", id);

  const imagePaths = (images ?? []).map((i) => i.storage_path).filter(Boolean);
  const tourPaths = (tours ?? []).map((t) => t.storage_path).filter(Boolean) as string[];

  if (imagePaths.length) await supabase.storage.from(BUCKETS.images).remove(imagePaths);
  if (tourPaths.length) await supabase.storage.from(BUCKETS.panoramas).remove(tourPaths);

  await supabase.from("properties").delete().eq("id", id).eq("agent_id", user.id);

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties");
}

export async function togglePublish(id: string, publish: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const { error } = await supabase
    .from("properties")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("agent_id", user.id);

  if (error) return { error: readableDbError(error.message) };

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${id}/edit`);
  return { success: publish ? "Нийтэллээ" : "Нийтлэлээс хаслаа" };
}

/* ---------------------------------------------------------------- media --- */

export async function registerImage(input: {
  propertyId: string;
  url: string;
  storagePath: string;
  kind: ImageKind;
  sortOrder?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const { error } = await supabase.from("property_images").insert({
    property_id: input.propertyId,
    url: input.url,
    storage_path: input.storagePath,
    kind: input.kind,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) return { error: error.message };

  // First uploaded photo becomes the cover.
  if (input.kind === "photo") {
    await supabase
      .from("properties")
      .update({ cover_image_url: input.url })
      .eq("id", input.propertyId)
      .is("cover_image_url", null);
  }

  revalidatePath(`/dashboard/properties/${input.propertyId}/edit`);
  return { success: "ok" };
}

export async function deleteImage(imageId: string, propertyId: string) {
  const supabase = await createClient();
  const { data: image } = await supabase
    .from("property_images")
    .select("storage_path")
    .eq("id", imageId)
    .single();

  if (image?.storage_path) await supabase.storage.from(BUCKETS.images).remove([image.storage_path]);
  await supabase.from("property_images").delete().eq("id", imageId);

  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
}

export async function setCoverImage(propertyId: string, url: string) {
  const supabase = await createClient();
  await supabase.from("properties").update({ cover_image_url: url }).eq("id", propertyId);
  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
}

/* ---------------------------------------------------------------- tours --- */

export async function addTourScene(input: {
  propertyId: string;
  roomName: string;
  panoramaUrl: string;
  storagePath: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const { count } = await supabase
    .from("property_tours")
    .select("id", { count: "exact", head: true })
    .eq("property_id", input.propertyId);

  const order = count ?? 0;
  const sceneKey = `${slugify(input.roomName)}`;

  const { error } = await supabase.from("property_tours").insert({
    property_id: input.propertyId,
    scene_key: sceneKey,
    room_name: input.roomName,
    panorama_url: input.panoramaUrl,
    storage_path: input.storagePath,
    sort_order: order,
    is_default: order === 0,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/properties/${input.propertyId}/edit`);
  return { success: "ok" };
}

export async function renameTourScene(tourId: string, propertyId: string, roomName: string) {
  const supabase = await createClient();
  await supabase.from("property_tours").update({ room_name: roomName }).eq("id", tourId);
  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
}

export async function deleteTourScene(tourId: string, propertyId: string) {
  const supabase = await createClient();
  const { data: tour } = await supabase
    .from("property_tours")
    .select("storage_path")
    .eq("id", tourId)
    .single();

  if (tour?.storage_path) await supabase.storage.from(BUCKETS.panoramas).remove([tour.storage_path]);
  await supabase.from("property_tours").delete().eq("id", tourId);

  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
}
