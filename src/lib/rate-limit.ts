import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function currentWindowStart(): Date {
  return new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
}

// Fixed 60s window per IP, not sliding — simple and enough to stop
// sequential brute-force scraping of the keyspace without punishing a real
// visitor scanning several pins in a row.
export async function isRateLimited(ip: string): Promise<boolean> {
  const windowStart = currentWindowStart();

  const hit = await prisma.rateLimitHit.upsert({
    where: { ip_windowStart: { ip, windowStart } },
    update: { count: { increment: 1 } },
    create: { ip, windowStart, count: 1 },
  });

  // Opportunistically sweep old windows instead of running a cron for it —
  // cheap at this traffic scale, and keeps the table from growing forever.
  if (Math.random() < 0.01) {
    await prisma.rateLimitHit.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 60 * WINDOW_MS) } },
    });
  }

  return hit.count > MAX_PER_WINDOW;
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
