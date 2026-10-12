/** Nhận dạng container audio bằng magic bytes — tin hơn mime client tự khai (iOS Safari hay trả '' hoặc octet-stream) */
export function detectAudio(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: 'audio/webm', ext: 'webm' }; // EBML
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  if (buf.length >= 3 && buf.subarray(0, 3).toString('latin1') === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' }; // MPEG frame sync
  return null;
}
