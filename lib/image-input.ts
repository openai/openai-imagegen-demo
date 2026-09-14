export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;

export const isSupportedImageDataUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) return false;
  const header = /^data:image\/(?:png|jpeg|webp);base64,/.exec(value);
  if (!header) return false;
  const base64 = value.slice(header[0].length);
  if (!base64.length || base64.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return false;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding <= MAX_IMAGE_BYTES;
};
