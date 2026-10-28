import { prisma } from "@/lib/prisma";
import { parsePinNumber } from "@/lib/pin-number";
import { downloadHoldingPhoto } from "@/lib/storage";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

type Params = { params: Promise<{ number: string }> };

// Deliberately public, no auth check — the current holder chose to make
// their front photo public on the pin's journey page (see
// src/components/PinView.tsx for the reasoning). Only ever serves the
// CURRENT open holding's FRONT photo for this pin (never a pending claim's);
// back/other photos and anything from a released holding are never
// reachable through this route.
export async function GET(request: Request, { params }: Params) {
  const { number: rawNumber } = await params;
  const pinNumber = parsePinNumber(rawNumber);
  if (pinNumber === null) return new Response("Not found", { status: 404 });

  // Same shared per-IP budget as the /pins directory (brief section 8) — a
  // page view and its photo both draw from one counter, so a normal visit
  // isn't penalized twice, but scraping the directory still hits the cap.
  if (await isRateLimited(getClientIp(request.headers))) {
    return new Response("Too many requests — please slow down and try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const pin = await prisma.pin.findUnique({
    where: { number: pinNumber },
    include: { holdings: { where: { releasedAt: null, pending: false }, include: { photos: true } } },
  });
  const frontPhoto = pin?.holdings[0]?.photos.find((p) => p.kind === "FRONT");
  if (!frontPhoto) return new Response("Not found", { status: 404 });

  const downloaded = await downloadHoldingPhoto(frontPhoto.url);
  if (!downloaded) return new Response("Not found", { status: 404 });

  return new Response(downloaded.data, {
    headers: { "Content-Type": downloaded.contentType, "Cache-Control": "public, max-age=300" },
  });
}
