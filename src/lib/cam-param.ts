import type { CamId } from '@/lib/camera';

/** đọc ?cam= an toàn — chỉ 0 hoặc 1 (2 lens JOOAN), mặc định 0 */
export function camParam(req: Request): CamId {
  try {
    const c = Number(new URL(req.url).searchParams.get('cam') || '0');
    return c === 1 ? 1 : 0;
  } catch { return 0; }
}
