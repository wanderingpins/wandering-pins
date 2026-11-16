// Which side of a cork card (PinCard, HoldingCard) the photo sits on. The usual
// layout is photo (and the name above it) to the left, sticker on the photo's
// lower-left corner, note to the lower right; `mirrored` flips all three.
// Full class strings, not built ones, so Tailwind can see them.
export function cardSides(mirrored: boolean) {
  return mirrored
    ? { photo: "mr-3 self-end", sticker: "-right-6 sm:-right-11", note: "self-start" }
    : { photo: "ml-3 self-start", sticker: "-left-6 sm:-left-11", note: "self-end" };
}
