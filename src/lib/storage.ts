import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "holding-photos";

// Server-only — uses the secret key so it can read/write a private bucket
// regardless of RLS. Never import this from a client component.
function adminStorage() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  return client.storage.from(BUCKET);
}

export async function uploadHoldingPhoto(
  holdingId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const path = `${holdingId}/${randomUUID()}.jpg`;
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
