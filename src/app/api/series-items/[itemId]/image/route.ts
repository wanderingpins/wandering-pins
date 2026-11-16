import { prisma } from "@/lib/prisma";
import { downloadHoldingPhoto } from "@/lib/storage";

type Params = { params: Promise<{ itemId: string }> };

// Public: a series item's reference picture (see SeriesItem.imagePath) is
// meant to be seen by anyone browsing the checklist. Not rate-limited like the
// pin photo route: these are catalog pictures, not a per-pin scrape target, a
// series page can show dozens at once (the 30/min budget would cut them off),
// and the long cache below keeps repeat views off the server.
export async function GET(_request: Request, { params }: Params) {
  const { itemId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(itemId)) return new Response("Not found", { status: 404 });

  const item = await prisma.seriesItem.findUnique({ where: { id: itemId }, select: { imagePath: true } });
  if (!item?.imagePath) return new Response("Not found", { status: 404 });

  const downloaded = await downloadHoldingPhoto(item.imagePath);
  if (!downloaded) return new Response("Not found", { status: 404 });

  // A replaced image gets a new ?v= in the page's <img src>, so a long cache
  // is safe; an admin removal 404s at the page level immediately.
  return new Response(downloaded.data, {
    headers: { "Content-Type": downloaded.contentType, "Cache-Control": "public, max-age=3600" },
  });
}
