/** Guardrail nhiệm vụ extra: claim PHẢI kèm ảnh bằng chứng (chấp nhận jpeg/png/webp base64) */
export function isValidClaimPhoto(photo: unknown): boolean {
  return typeof photo === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(photo);
}
