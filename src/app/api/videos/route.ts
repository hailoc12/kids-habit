import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentUser } from '@/lib/auth';

/** Kho video bố mẹ tuyển chọn — YouTube ID cụ thể, KHÔNG feed/browse */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = db.prepare(`SELECT * FROM videos WHERE active=1 AND family_id=? ORDER BY id`).all(me.familyId ?? 1);
  const setting = db.prepare(`SELECT value FROM app_settings WHERE key='yt_library_only'`).get() as any;
  const libraryOnly = setting?.value === '1' || setting?.value === 'true';
  return NextResponse.json({ videos: rows, libraryOnly });
}
