"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { geocodePlace, regionFieldsFor } from "@/lib/geocode";
import { createHoldingFromForm, parseRegisterForm, REGION_LOOKUP_FAILED, type RegisterState } from "@/lib/register-form";
import { prepareRegisterPhoto, saveRegisterPhoto } from "@/lib/register-photo";

// Adds a pin to the user's account with no sticker — the free path for a pin
// they own but haven't got a passport for. It records exactly one holding
// (how, when, where they got it); with no sticker there's no code to release,
// claim or check in by, so nothing further can happen to it until one is
// attached (attachStickerToPin in s/[code]/claim/actions.ts).
export async function createPinWithoutSticker(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const user = await requireAppUser("/pins/new");

  const parsed = parseRegisterForm(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fill in how, when, and where you got this pin." };
  }

  const geocoded = await geocodePlace(parsed.data.place);
  if (!geocoded) {
    return { status: "error", message: "Couldn't find that place — try a city name." };
  }
  const region = await regionFieldsFor(geocoded, parsed.data.regionOnly);
  if (!region.ok) return { status: "error", message: REGION_LOOKUP_FAILED };
  const place = { ...geocoded, ...region.fields };
  const photo = await prepareRegisterPhoto(formData);
  if (!photo.ok) return { status: "error", message: photo.message };

  const { pinNumber, holdingId } = await prisma.$transaction(async (tx) => {
    const pin = await tx.pin.create({ data: {}, select: { id: true, number: true } });
    const holdingId = await createHoldingFromForm(tx, {
      pinId: pin.id,
      userId: user.id,
      data: parsed.data,
      place,
      pending: false,
    });
    return { pinNumber: pin.number, holdingId };
  });
  await saveRegisterPhoto(holdingId, photo.buffer);

  redirect(`/p/${pinNumber}`);
}
