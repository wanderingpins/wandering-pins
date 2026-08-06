import { getAuthClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadHoldingPhoto } from "@/lib/storage";

type Params = { params: Promise<{ holdingId: string; photoId: string }> };

// Streams the photo bytes through our own auth check on every request,
// rather than redirecting to a signed storage URL — a signed URL would
// itself be a shareable "direct asset URL" that bypasses this check for
// its lifetime, which the brief's DoD explicitly rules out.
export async function GET(_request: Request, { params }: Params) {
  const { holdingId, photoId } = await params;

  const claims = await getAuthClaims();
  if (!claims?.sub) {
    return new Response("Not found", { status: 404 });
  }

  const photo = await prisma.holdingPhoto.findUnique({
    where: { id: photoId },
    include: { holding: true },
  });
  if (!photo || photo.holdingId !== holdingId || photo.holding.userId !== claims.sub) {
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
