import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "holding-photos";

// Server-only — uses the secret key so it can read/write a private bucket
// regardless of RLS. Never import this from a client component.
function adminStorage() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  return client.storage.from(BUCKET);
}

// `ownerKey` is just a folder prefix — a holding id for a holding's own
// photos, a check-in id for a check-in's (see checkin-actions.ts). Nothing
// here cares which; both live in the same private bucket.
export async function uploadHoldingPhoto(
  ownerKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const path = `${ownerKey}/${randomUUID()}.jpg`;
  const { error } = await adminStorage().upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function downloadHoldingPhoto(path: string): Promise<{ data: Blob; contentType: string } | null> {
  const { data, error } = await adminStorage().download(path);
  if (error || !data) return null;
  return { data, contentType: data.type || "image/jpeg" };
}

export async function deleteHoldingPhoto(path: string): Promise<void> {
  await adminStorage().remove([path]);
}
