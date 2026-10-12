import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { currentRole } from '@/lib/auth';

/** GET /api/timetable → thời khóa biểu tuần (child xem được) + hôm nay là thứ mấy */
export async function GET() {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = db.prepare(`SELECT * FROM timetable ORDER BY weekday, period`).all();
  const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dow = nowVN.getDay(); // JS: 0=CN, 1=T2, ..., 6=T7
  const weekday = dow === 0 ? 8 : dow + 1; // timetable: 2=T2, ..., 7=T7, 8=CN
  return NextResponse.json({ rows, today: weekday });
}
