import { getAuthClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadHoldingPhoto } from "@/lib/storage";
import { BEST_EFFORT_AUTH_TIMEOUT_MS } from "@/lib/with-timeout";

type Params = { params: Promise<{ checkInId: string; photoId: string }> };

// Same auth-gated streaming pattern as
// src/app/api/holdings/[holdingId]/photos/[photoId]/route.ts — never a
// signed storage URL, so this check runs on every request, not just once.
export async function GET(_request: Request, { params }: Params) {
  const { checkInId, photoId } = await params;

  // Best-effort: a timeout here just means this one image fails to load
  // (same 404 as any other auth failure) instead of hanging.
  const claims = await getAuthClaims(BEST_EFFORT_AUTH_TIMEOUT_MS);
  if (!claims?.sub) {
    return new Response("Not found", { status: 404 });
  }

  const photo = await prisma.holdingCheckInPhoto.findUnique({
    where: { id: photoId },
    include: { checkIn: { include: { holding: true } } },
  });
  if (!photo || photo.checkInId !== checkInId || photo.checkIn.holding.userId !== claims.sub) {
    return new Response("Not found", { status: 404 });
  }

  const downloaded = await downloadHoldingPhoto(photo.url);
  if (!downloaded) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(downloaded.data, {
    headers: {
      "Content-Type": downloaded.contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
