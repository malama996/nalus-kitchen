import { supabase } from "@/integrations/supabase/client";

export const MENU_PHOTO_BUCKET = "menu-photos";
export const UPLOAD_PREFIX = "upload:";

export function isUploadedKey(key: string | null | undefined): key is string {
  return typeof key === "string" && key.startsWith(UPLOAD_PREFIX);
}

/** Creates short-lived signed URLs for every uploaded photo key given. */
export async function signMenuPhotos(keys: Array<string | null | undefined>): Promise<Record<string, string>> {
  const paths = [...new Set(keys.filter(isUploadedKey))].map((key) => key.slice(UPLOAD_PREFIX.length));
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(MENU_PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  const result: Record<string, string> = {};
  (data ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) result[`${UPLOAD_PREFIX}${entry.path}`] = entry.signedUrl;
  });
  return result;
}

/** Uploads a photo file and returns the image_key to store on the menu item. */
export async function uploadMenuPhoto(file: File): Promise<{ key: string | null; error: string | null }> {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) return { key: null, error: "Use a JPG, PNG or WebP image." };
  if (file.size > 5 * 1024 * 1024) return { key: null, error: "Image must be 5 MB or smaller." };
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(MENU_PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { key: null, error: error.message };
  return { key: `${UPLOAD_PREFIX}${path}`, error: null };
}
