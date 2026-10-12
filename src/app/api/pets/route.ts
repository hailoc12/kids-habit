import { NextResponse } from 'next/server';
import db, { runInTransaction } from '@/lib/db';
import { nowVN, dateStrVN } from '@/lib/dates';
import { currentUser } from '@/lib/auth';
import { currentChildId } from '@/lib/childscope';
import { balance } from '@/lib/service';
import { computeStats, petSpeak, canPlay, eggReady, PET_RULES } from '@/lib/pet';
import { SETTINGS } from '@/lib/settings';

/** GET → pets + stats + shop + nhiệm vụ extra hôm nay */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const now = nowVN();
  const pets = (db.prepare(`SELECT * FROM pets WHERE retired=0 AND (child_id=? OR child_id IS NULL) ORDER BY id`).all(childId) as any[]).filter((p: any) => p.child_id === null || p.child_id === childId).map((p) => {
    const stats = computeStats(p, now);
    return {
      ...p,
      stats,
      speech: petSpeak(p.name, stats, SETTINGS.childName()),
      eggReady: stats.stage === 'egg' && eggReady(p.born_at, now),
      canPlay: stats.stage !== 'egg' && canPlay(p.last_play_at, now),
    };
  });
  const shop = db.prepare(`SELECT * FROM shop_items WHERE active=1 AND family_id=? ORDER BY kind, price`).all(me.familyId ?? 1);
  const missions = db.prepare(`SELECT * FROM extra_missions WHERE active=1 ORDER BY id`).all();
  const claimsToday = db.prepare(`SELECT mission_id FROM mission_claims WHERE date=? AND child_id=?`).all(dateStrVN(), childId);
  return NextResponse.json({ pets, shop, missions, claimedToday: claimsToday.map((c: any) => c.mission_id), balance: balance(childId) });
}

/**
 * POST /api/pets
 * {action:'buy-pet', itemId, name}          — mua pet từ store (trừ sao)
 * {action:'feed', petId, itemId}            — cho ăn (trừ sao mua đồ ăn)
 * {action:'play', petId}                    — chơi (miễn phí, cooldown)
 * {action:'hatch', petId}                   — mở trứng (đủ 24h)
 * {action:'rename', petId, name}
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const childId = currentChildId(me);
  const { action, itemId, petId, name } = await req.json().catch(() => ({}));
  const now = nowVN().toISOString();
  const spend = (amount: number, refType: string, refId: number | null, note: string) =>
    db.prepare(`INSERT INTO point_ledger (date, type, amount, ref_type, ref_id, note, created_at, child_id) VALUES (?,?,?,?,?,?,?,?)`)
      .run(dateStrVN(), 'spend', -amount, refType, refId, note, now, childId);

  if (action === 'buy-pet') {
    const item = db.prepare(`SELECT * FROM shop_items WHERE id=? AND kind='pet' AND active=1`).get(itemId) as any;
    if (!item) return NextResponse.json({ error: 'không tìm thấy pet trong cửa hàng' }, { status: 400 });
    const owned = (db.prepare(`SELECT COUNT(*) c FROM pets WHERE type_code=?`).get(item.code) as any).c;
    if (owned > 0) return NextResponse.json({ error: 'con này con có rồi nhé!' }, { status: 400 });
    if (balance(childId) < item.price) return NextResponse.json({ error: 'chưa đủ sao — làm nhiệm vụ nhỏ thêm nhé!' }, { status: 400 });
    runInTransaction(() => {
      spend(item.price, 'pet', null, `nhận nuôi: ${item.title}`);
      db.prepare(`INSERT INTO pets (name, type_code, type_emoji, born_at, last_fed_at, last_play_at, child_id) VALUES (?,?,?,?,?,?,?)`)
        .run((name || item.title).slice(0, 20), item.code, item.emoji, now, now, now, childId);
    });
    return NextResponse.json({ ok: true });
  }

  const pet = db.prepare(`SELECT * FROM pets WHERE id=? AND retired=0 AND (child_id=? OR child_id IS NULL)`).get(petId, childId) as any;
  if (!pet) return NextResponse.json({ error: 'không tìm thấy pet' }, { status: 400 });

  if (action === 'feed') {
    const item = db.prepare(`SELECT * FROM shop_items WHERE id=? AND kind='food' AND active=1`).get(itemId) as any;
    if (!item) return NextResponse.json({ error: 'không có món này' }, { status: 400 });
    if (balance(childId) < item.price) return NextResponse.json({ error: 'chưa đủ sao — làm nhiệm vụ nhỏ thêm nhé!' }, { status: 400 });
    runInTransaction(() => {
      spend(item.price, 'food', pet.id, `mua ${item.title} cho ${pet.name}`);
      db.prepare(`UPDATE pets SET last_fed_at=? WHERE id=?`).run(now, pet.id);
    });
    return NextResponse.json({ ok: true, fed: item.title });
  }
  if (action === 'play') {
    if (!canPlay(pet.last_play_at, nowVN())) return NextResponse.json({ error: `${pet.name} vừa chơi xong — nghỉ chút nhé!` }, { status: 400 });
    db.prepare(`UPDATE pets SET last_play_at=? WHERE id=?`).run(now, pet.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'hatch') {
    if (!eggReady(pet.born_at, nowVN())) return NextResponse.json({ error: 'trứng chưa đủ ngày — chăm thêm chút nữa!' }, { status: 400 });
    db.prepare(`UPDATE pets SET hatched_at=?, last_fed_at=?, last_play_at=? WHERE id=?`).run(now, now, now, pet.id);
    return NextResponse.json({ ok: true });
  }
  if (action === 'rename') {
    if (!name) return NextResponse.json({ error: 'chưa đặt tên' }, { status: 400 });
    db.prepare(`UPDATE pets SET name=? WHERE id=?`).run(String(name).slice(0, 20), pet.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
