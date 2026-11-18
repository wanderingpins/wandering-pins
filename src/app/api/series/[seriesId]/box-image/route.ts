import { prisma } from "@/lib/prisma";
import { downloadHoldingPhoto } from "@/lib/storage";

type Params = { params: Promise<{ seriesId: string }> };

// Public: a series' blind-box picture (see Series.boxImagePath). Same reasoning
// as /api/series-items/{id}/image — a catalog picture meant for anyone, not
// rate-limited, cached with a ?v= that changes when it's replaced.
export async function GET(_request: Request, { params }: Params) {
  const { seriesId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(seriesId)) return new Response("Not found", { status: 404 });

  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { boxImagePath: true } });
  if (!series?.boxImagePath) return new Response("Not found", { status: 404 });

  const downloaded = await downloadHoldingPhoto(series.boxImagePath);
  if (!downloaded) return new Response("Not found", { status: 404 });

  return new Response(downloaded.data, {
    headers: { "Content-Type": downloaded.contentType, "Cache-Control": "public, max-age=3600" },
  });
}
