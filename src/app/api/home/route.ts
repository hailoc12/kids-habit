import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { soundbar, appletv, inSafeWindow, logHome } from '@/lib/home';
import path from 'path';

/**
 * Home Automation API — parent only (con 403; pomodoro hook là server-internal).
 * GET  → trạng thái thiết bị
 * POST {device:'soundbar', action:'volume_up'|'volume_down'|'play_file'|'stop'}
 * POST {device:'appletv', action:'turn_on'|'turn_off'|'home'|'launch_youtube'|'launch_music'|'play_pause'}
 */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'parent' && me.role !== 'system_admin') return NextResponse.json({ error: 'parent only' }, { status: 403 });
  let soundbarInfo: string | null = null;
  try { soundbarInfo = await soundbar.info(); } catch { soundbarInfo = null; }
  let atvInfo: string | null = null;
  try { atvInfo = await appletv.info(); } catch { atvInfo = null; }
  return NextResponse.json({
    soundbar: { online: !!soundbarInfo, info: soundbarInfo },
    appletv: { paired: appletv.paired(), online: !!atvInfo, info: atvInfo },
    safeWindow: inSafeWindow(),
  });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'parent' && me.role !== 'system_admin') {
    logHome(`BLOCK child ${me.username} cố gọi lệnh nhà`);
    return NextResponse.json({ error: 'chỉ bố mẹ điều khiển được thiết bị nhà' }, { status: 403 });
  }
  const { device, action, file } = await req.json().catch(() => ({}));

  // cửa sổ an toàn — sau 20h30 không lệnh bật/âm thanh (trừ tắt/stop/về home)
  const passive = action === 'stop' || action === 'turn_off' || action === 'home';
  if (!passive && !inSafeWindow()) {
    return NextResponse.json({ error: 'giờ ngủ rồi — sau 6h sáng mai mới được bật (chống ảnh hưởng con ngủ)' }, { status: 423 });
  }

  try {
    if (device === 'soundbar') {
      if (action === 'volume_up') { await soundbar.volumeUp(); return NextResponse.json({ ok: true }); }
      if (action === 'volume_down') { await soundbar.volumeDown(); return NextResponse.json({ ok: true }); }
      if (action === 'stop') { await soundbar.stop(); return NextResponse.json({ ok: true }); }
      if (action === 'play_file') {
        const safe = path.basename(String(file || ''));
        if (!safe) return NextResponse.json({ error: 'thiếu tên file (đặt trong data/home-audio/)' }, { status: 400 });
        const abs = path.join(process.env.KH_DATA_DIR || path.join(process.cwd(), 'data'), 'home-audio', safe);
        await soundbar.playFile(abs);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    if (device === 'appletv') {
      if (!appletv.paired()) return NextResponse.json({ error: 'Apple TV chưa ghép đôi' }, { status: 409 });
      if (action === 'turn_on') { await appletv.turnOn(); return NextResponse.json({ ok: true }); }
      if (action === 'turn_off') { await appletv.turnOff(); return NextResponse.json({ ok: true }); }
      if (action === 'home') { await appletv.home(); return NextResponse.json({ ok: true }); }
      if (action === 'launch_youtube') { await appletv.turnOn(); await appletv.launchApp('com.google.ios.youtube'); return NextResponse.json({ ok: true }); }
      if (action === 'launch_youtube_kids') { await appletv.turnOn(); await appletv.launchApp('com.google.ios.youtubekids'); return NextResponse.json({ ok: true }); }
      if (action === 'launch_music') { await appletv.turnOn(); await appletv.launchApp('com.apple.TVMusic'); return NextResponse.json({ ok: true }); }
      if (action === 'play_pause') { await appletv.playPause(); return NextResponse.json({ ok: true }); }
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    return NextResponse.json({ error: 'chưa hỗ trợ thiết bị này' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: `thiết bị không phản hồi: ${e.message}` }, { status: 502 });
  }
}
