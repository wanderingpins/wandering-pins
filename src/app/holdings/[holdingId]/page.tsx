import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { formatMonthYear } from "@/lib/timeline";
import { DetailsForm } from "./DetailsForm";
import { PhotoUploadForm } from "./PhotoUploadForm";
import { deletePhoto } from "./actions";

type Props = { params: Promise<{ holdingId: string }> };

export default async function HoldingPage({ params }: Props) {
  const { holdingId } = await params;
  const user = await requireAppUser(`/holdings/${holdingId}`);

  const holding = await getOwnedHolding(holdingId, user.id);
  if (!holding) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">That&apos;s not your holding</h1>
      </main>
    );
  }

  const [pin, title, note, photos] = await Promise.all([
    prisma.pin.findUniqueOrThrow({ where: { id: holding.pinId } }),
    prisma.pinTitle.findUnique({ where: { holdingId } }),
    prisma.holdingNote.findUnique({ where: { holdingId } }),
    prisma.holdingPhoto.findMany({ where: { holdingId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-sm text-neutral-500">
        <Link href={`/p/${pin.slug}`} className="hover:underline">
          Pin {pin.slug}
        </Link>{" "}
        · {holding.placeLabel} · {formatMonthYear(holding.acquiredAt)}
      </p>
      <h1 className="mt-1 text-xl font-semibold">Your notes on this pin</h1>

      <PrivacyBanner />

      <section className="mt-6">
        <DetailsForm holdingId={holdingId} initialTitle={title?.title ?? ""} initialNotes={note?.body ?? ""} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Photos</h2>
        <PrivacyBanner />
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route; next/image's optimizer would need its own auth pass-through */}
                <img
                  src={`/api/holdings/${holdingId}/photos/${photo.id}`}
                  alt={photo.kind.toLowerCase()}
                  className="aspect-square w-full rounded-md object-cover"
                />
                <form action={deletePhoto.bind(null, holdingId, photo.id)} className="absolute right-1 top-1">
                  <button
                    type="submit"
                    className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                  >
                    &times;
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <PhotoUploadForm holdingId={holdingId} />
        </div>
      </section>
    </main>
  );
}

function PrivacyBanner() {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
      🔒 Only you can see this
    </p>
  );
}
