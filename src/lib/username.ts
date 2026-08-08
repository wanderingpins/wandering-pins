import { z } from "zod";

// Lowercased on input so "JohnDoe" and "johndoe" collide — one canonical
// form, no case-insensitive unique index needed. 3-20 chars keeps handles
// readable; letters/digits/underscore only avoids URL- and display-unsafe
// characters, since this becomes the public identity on the pin journey
// (replacing the old auto-generated displayName).
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "3-20 characters: lowercase letters, numbers, and underscores only");
