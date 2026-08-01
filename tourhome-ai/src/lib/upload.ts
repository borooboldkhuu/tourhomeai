import { createClient } from "@/lib/supabase/client";

export type UploadResult = { url: string; path: string };

/** Sanitised, collision-proof object name inside {userId}/{propertyId}/. */
function objectName(userId: string, propertyId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const safe = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 40);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${userId}/${propertyId}/${Date.now()}-${rand}-${safe}.${ext}`;
}

/**
 * Uploads a file straight from the browser to Supabase Storage.
 * Storage RLS requires the first path segment to equal auth.uid().
 */
export async function uploadFile(
  bucket: string,
  file: File,
  propertyId: string,
): Promise<UploadResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтрэх шаардлагатай");

  const path = objectName(user.id, propertyId, file);

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Rough 2:1 equirectangular check — panoramas must be 2:1 to render correctly. */
export function checkEquirectangular(file: File): Promise<{ ok: boolean; width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      URL.revokeObjectURL(url);
      resolve({ ok: Math.abs(ratio - 2) < 0.15, width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, width: 0, height: 0 });
    };
    img.src = url;
  });
}
