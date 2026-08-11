// Shared between client (crop export) and server (validation/processing) —
// kept free of server-only deps (sharp, node:crypto) so the client bundle can
// import it directly.

// Longest side a stored holding photo is ever allowed to be.
export const MAX_PHOTO_DIMENSION = 1600;

// Hard ceiling on the raw upload the server will accept, before processing —
// a backstop against a modified client or a direct call to the server
// action, not the size we expect in normal use (the client compresses well
// under this before it ever uploads).
export const MAX_RAW_UPLOAD_BYTES = 10 * 1024 * 1024;

// What the client-side cropper aims for when it re-encodes the crop —
// generous enough to stay sharp, small enough to be a quick upload.
export const TARGET_UPLOAD_BYTES = 2 * 1024 * 1024;
