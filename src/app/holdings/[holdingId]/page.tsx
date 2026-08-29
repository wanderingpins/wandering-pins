import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { getOwnedHolding } from "@/lib/holdings";
import { formatMonthYear } from "@/lib/timeline";
import { DetailsForm } from "./DetailsForm";
import { PhotoUploadForm } from "./PhotoUploadForm";
import { deletePhoto } from "./actions";
import { AddCheckInForm } from "./AddCheckInForm";
import { CheckInNoteForm } from "./CheckInNoteForm";
import { CheckInPhotoUploadForm } from "./CheckInPhotoUploadForm";
import { deleteCheckIn, deleteCheckInPhoto } from "./checkin-actions";

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

  const [pin, title, note, photos, checkIns] = await Promise.all([
    prisma.pin.findUniqueOrThrow({ where: { id: holding.pinId } }),
    prisma.pinTitle.findUnique({ where: { holdingId } }),
    prisma.holdingNote.findUnique({ where: { holdingId } }),
    prisma.holdingPhoto.findMany({ where: { holdingId }, orderBy: { createdAt: "asc" } }),
    prisma.holdingCheckIn.findMany({
      where: { holdingId },
      orderBy: { loggedAt: "asc" },
      include: { note: true, photos: { orderBy: { createdAt: "asc" } } },
    }),
  ]);

  // A check-in is public movement, so it can only be logged against the
  // real, confirmed current holding — not a tentative/pending one, and not
  // a closed one (that stint is over).
  const canAddCheckIn = holding.releasedAt === null && !holding.pending;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-sm text-neutral-500">
        <Link href={`/p/${pin.slug}`} className="hover:underline">
          Pin {pin.slug}
        </Link>{" "}
        · {holding.placeLabel} · {formatMonthYear(holding.acquiredAt)}
      </p>
      <h1 className="mt-1 text-xl font-semibold">Your notes on this pin</h1>

      {holding.releasedAt && (
        <p className="mt-2 text-sm text-neutral-600">
          You let this pin go — add any details below, private and optional.
        </p>
      )}
      {holding.pending && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⏳ Unreleased — the current holder hasn&apos;t let this pin go yet. It&apos;s on your account, but it
          won&apos;t show up on this pin&apos;s public journey until they do.
        </p>
      )}

      <section className="mt-6">
        <DetailsForm
          holdingId={holdingId}
          initialTitle={title?.title ?? ""}
          initialNotes={note?.body ?? ""}
          initialReleaseDate={note?.releaseDate ? note.releaseDate.toISOString().slice(0, 10) : ""}
          initialReleasePlaceLabel={note?.releasePlaceLabel ?? ""}
          isReleased={holding.releasedAt !== null}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Photos</h2>
        <p className="mt-2 text-xs text-neutral-500">
          The front photo is shown publicly on this pin&apos;s page while this is your current holding. Back and
          other photos always stay private.
        </p>
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {photos.map((photo) => {
              const isPublic = photo.kind === "FRONT" && canAddCheckIn;
              return (
                <li key={photo.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route; next/image's optimizer would need its own auth pass-through */}
                  <img
                    src={`/api/holdings/${holdingId}/photos/${photo.id}`}
                    alt={photo.kind.toLowerCase()}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {isPublic ? "🌐 Public" : "🔒 Private"}
                  </span>
                  <form action={deletePhoto.bind(null, holdingId, photo.id)} className="absolute right-1 top-1">
                    <button
                      type="submit"
                      className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                    >
                      &times;
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <PhotoUploadForm holdingId={holdingId} />
        </div>
      </section>

      <section id="locations" className="mt-10 scroll-mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Locations</h2>
        <p className="mt-2 text-xs text-neutral-500">
          🌐 The place and date of each entry are public, same as where you got it. Photos and descriptions here
          always stay private.
        </p>

        {checkIns.length > 0 && (
          <ul className="mt-4 flex flex-col gap-4">
            {checkIns.map((checkIn) => (
              <li key={checkIn.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    🌐 {checkIn.placeLabel} · {formatMonthYear(checkIn.loggedAt)}
                  </p>
                  <form action={deleteCheckIn.bind(null, checkIn.id)}>
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                      Remove
                    </button>
                  </form>
                </div>

                <div className="mt-3">
                  <CheckInNoteForm checkInId={checkIn.id} initialBody={checkIn.note?.body ?? ""} />
                </div>

                {checkIn.photos.length > 0 && (
                  <ul className="mt-3 grid grid-cols-3 gap-2">
                    {checkIn.photos.map((photo) => (
                      <li key={photo.id} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route */}
                        <img
                          src={`/api/check-ins/${checkIn.id}/photos/${photo.id}`}
                          alt=""
                          className="aspect-square w-full rounded-md object-cover"
                        />
                        <form
                          action={deleteCheckInPhoto.bind(null, checkIn.id, photo.id)}
                          className="absolute right-1 top-1"
                        >
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
                <div className="mt-3">
                  <CheckInPhotoUploadForm checkInId={checkIn.id} photoCount={checkIn.photos.length} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {canAddCheckIn ? (
          <div className="mt-4">
            <AddCheckInForm holdingId={holdingId} />
          </div>
        ) : (
          checkIns.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">
              {holding.pending
                ? "You can log locations once this claim is confirmed."
                : "This stint is over, so no new locations can be logged here."}
            </p>
          )
        )}
      </section>
    </main>
  );
}
