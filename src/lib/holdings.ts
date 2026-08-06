import { prisma } from "@/lib/prisma";

// Every private-data action (notes, titles, photos) needs this same check —
// centralised so "unreachable by anyone but their owner" (brief section 10)
// can't drift between call sites.
export async function getOwnedHolding(holdingId: string, userId: string) {
  const holding = await prisma.pinHolding.findUnique({ where: { id: holdingId } });
  if (!holding || holding.userId !== userId) return null;
  return holding;
}
