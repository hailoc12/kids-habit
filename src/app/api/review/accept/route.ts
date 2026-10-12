import { NextResponse } from 'next/server';
import { acceptReview } from '@/lib/service';
import { requireRole } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { dateStrVN } from '@/lib/dates';

export async function POST(req: Request) {
  const role = await requireRole('parent');
  if (!role) return NextResponse.json({ error: 'parent only' }, { status: 403 });
  const { date, adjustments, noteToChild } = await req.json();
  try {
    const total = acceptReview(date || dateStrVN(), role.name, adjustments || [], noteToChild || '', currentChildId(role));
    return NextResponse.json({ ok: true, stars: total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
