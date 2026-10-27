import Link from "next/link";
import type { DirectoryPin } from "@/lib/pin-directory";
import { pinCardStyle } from "@/lib/pin-card-style";
import { PinNamePill } from "@/components/PinNamePill";
import { PinPhotoFrame } from "@/components/PinPhotoFrame";
import { PinSticker } from "@/components/PinSticker";
import { TornPaper } from "@/components/TornPaper";

// A smaller version of the /p/[slug] cork scene, for the /pins cork view: name
// in enamel on top, photo print, and a note pinned over the photo's lower
// right. Every field here is already public on /p/[slug] (see pin-directory.ts).
export function PinCard({ pin }: { pin: DirectoryPin }) {
  const { color, photoTilt, paperTilt, stickerColor, stickerTilt, photoPinColor, paperPinColor } = pinCardStyle(pin.slug);

  return (
    <Link
      href={`/p/${pin.slug}`}
      className="group flex flex-col items-center gap-5 rounded-lg p-2 transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
    >
      {/* Same left offset and width as the photo below, so the name sits
          centered over its pin rather than over the whole card. */}
      <div className="ml-3 flex w-40 justify-center self-start">
        <PinNamePill as="h2" size="sm" color={color}>
          {pin.title}
        </PinNamePill>
      </div>

      <div className="flex w-full flex-col">
        <div className="relative ml-3 self-start">
          <PinPhotoFrame tilt={photoTilt} pinColor={photoPinColor}>
            {pin.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- served through the same public per-pin photo route as /p/[slug]
              <img src={`/api/pins/${pin.slug}/photo`} alt={pin.title} className="size-36 object-cover" />
            ) : (
              <div className="flex size-36 items-center justify-center bg-navy text-xs text-neutral-500">No photo yet</div>
            )}
          </PinPhotoFrame>

          {/* Stuck over the photo's lower-left corner, on top of everything. */}
          <PinSticker
            className="absolute -bottom-9 -left-6 z-10 sm:-left-11"
            kicker={pin.holderDisplayName ? "With" : undefined}
            headline={pin.holderDisplayName ?? "UP FOR GRABS"}
            count={{ value: pin.verifiedCount, label: "Verified" }}
            srText={`${pin.holderDisplayName ? `Currently with ${pin.holderDisplayName}` : "Not currently held by anyone"}. ${pin.verifiedCount} verified location${pin.verifiedCount === 1 ? "" : "s"}.`}
            color={stickerColor}
            tilt={stickerTilt}
          />
        </div>

        {/* The note is just the description now; no description, no note. */}
        {pin.description && (
          <div className="-mt-8 self-end">
            <TornPaper compact tilt={paperTilt} pinColor={paperPinColor}>
              <p className="line-clamp-3 whitespace-pre-wrap font-hand text-xl leading-7 text-ink">{pin.description}</p>
            </TornPaper>
          </div>
        )}
      </div>
    </Link>
  );
}
