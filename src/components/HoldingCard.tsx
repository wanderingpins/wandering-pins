import Link from "next/link";
import type { AcquiredVia } from "@/generated/prisma/client";
import { formatAcquisition } from "@/lib/timeline";
import { pinCardStyle } from "@/lib/pin-card-style";
import { PinNamePill } from "@/components/PinNamePill";
import { PinPhotoFrame } from "@/components/PinPhotoFrame";
import { PinSticker } from "@/components/PinSticker";
import { TornPaper } from "@/components/TornPaper";

// The /my-pins cork view's card — the same scene as PinCard on /pins (name in
// enamel, photo print, paper note, starburst sticker, push pins, and the same
// per-pin colors and tilts, since they come from the same pin number), but about one
// of YOUR holdings: the photo is the private front photo of that holding, the
// note carries the acquisition line and the pin number (plus the sticker code, for a pin you hold), and the sticker says where
// the pin is now. Two destinations, so two links: the card goes to the public
// pin page, a chip under it goes to the private notes-and-photos page.
export function HoldingCard({
  id,
  pinNumber,
  stickerLine,
  title,
  description,
  photoSrc,
  placeLabel,
  acquiredAt,
  acquiredVia,
  currentLocation,
  released,
  pending,
}: {
  id: string;
  pinNumber: number;
  stickerLine: string | null;
  title: string;
  description: string;
  photoSrc?: string;
  placeLabel: string;
  acquiredAt: Date;
  acquiredVia: AcquiredVia;
  currentLocation: string | null;
  released?: boolean;
  pending?: boolean;
}) {
  const { color, photoTilt, paperTilt, stickerColor, stickerTilt, photoPinColor, paperPinColor } = pinCardStyle(String(pinNumber));
  const sticker = stickerFor({ pending, released, currentLocation, placeLabel });
  const chip =
    "rounded-full bg-navy/90 px-3 py-1 text-xs font-medium text-accent shadow hover:bg-navy hover:text-accent-hover";

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg p-2">
      <Link
        href={`/p/${pinNumber}`}
        className="flex w-full flex-col items-center gap-5 transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
      >
        {/* Same left offset and width as the photo below, so the name sits
            centered over its pin rather than over the whole card. */}
        <div className="ml-3 flex w-40 justify-center self-start">
          <PinNamePill as="h2" size="sm" color={color}>
            {title}
          </PinNamePill>
        </div>

        <div className="flex w-full flex-col">
          <div className="relative ml-3 self-start">
            <PinPhotoFrame tilt={photoTilt} pinColor={photoPinColor}>
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, per-user image behind an auth-gated route, same as the holding detail page
                <img src={photoSrc} alt="" className="size-36 object-cover" />
              ) : (
                <div className="flex size-36 items-center justify-center bg-navy text-xs text-neutral-500">No photo yet</div>
              )}
            </PinPhotoFrame>

            <PinSticker
              className="absolute -bottom-9 -left-6 z-10 sm:-left-11"
              kicker={sticker.kicker}
              headline={sticker.headline}
              srText={sticker.srText}
              color={stickerColor}
              tilt={stickerTilt}
            />
          </div>

          {/* Always present here (there's always an acquisition line), unlike
              /pins where the note exists only for pins with a description. */}
          <div className="-mt-8 self-end">
            <TornPaper compact tilt={paperTilt} pinColor={paperPinColor}>
              {description && (
                <p className="line-clamp-2 whitespace-pre-wrap font-hand text-xl leading-7 text-ink">{description}</p>
              )}
              <p className="line-clamp-2 font-hand text-lg leading-7 text-ink">
                {formatAcquisition(acquiredVia, placeLabel, acquiredAt)}
              </p>
              <p className="truncate font-mono text-[11px] leading-7 text-ink/60">
                Pin #{pinNumber}
                {stickerLine && ` · ${stickerLine}`}
              </p>
            </TornPaper>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/holdings/${id}`} className={chip}>
          Notes &amp; photos
        </Link>
        {released && (
          <Link href={`/p/${pinNumber}`} className={chip}>
            See where it went &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

// What the sticker says: where the pin is now (or that it isn't released yet).
// Phrases are uppercased here because the sticker leaves the text as given.
function stickerFor({
  pending,
  released,
  currentLocation,
  placeLabel,
}: {
  pending?: boolean;
  released?: boolean;
  currentLocation: string | null;
  placeLabel: string;
}): { kicker?: string; headline: string; srText: string } {
  if (pending) {
    // "Unreleased" as the headline is too wide for the sticker and would
    // break mid-word, so it's the small kicker and the headline is shorter.
    return {
      kicker: "Unreleased",
      headline: "PENDING",
      srText: "Unreleased — waiting for the current holder to let it go.",
    };
  }
  if (released) {
    return currentLocation
      ? { kicker: "Now in", headline: currentLocation, srText: `Now in ${currentLocation}.` }
      : { headline: "UP FOR GRABS", srText: "Not currently held by anyone." };
  }
  const where = currentLocation ?? placeLabel;
  return { kicker: "Now in", headline: where, srText: `Currently in ${where}.` };
}
