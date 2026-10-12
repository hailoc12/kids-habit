// Unit tests — scoring + feedback + pomodoro (guardrails giáo dục là contract, phải test)
import { pointsForInstance, softStreak, graduationEligible, streakBadges } from '../src/lib/scoring';
import { renderFeedback, checkBanned } from '../src/lib/feedback';
import { validatePomodoro, phaseOf, fmtCountdown, idleExpired, tvOverdue, IDLE_EXPIRE_MIN } from '../src/lib/pomodoro';
import { computeStats, awakeHours, petSpeak, canPlay, eggReady } from '../src/lib/pet';
import { isValidClaimPhoto } from '../src/lib/mission';
import { detectAudio } from '../src/lib/audio';
import { sanitizePrompt, chibiPrompt, isJpegOrPng } from '../src/lib/gemini';
import { safeTitle, moveId, isSafeColorbookRel } from '../src/lib/colorbook';
import { SONGS, validateSong } from '../src/app/piano/songs';
import { touchesScopedTable, requiredScope, assertScoped, FAMILY_TABLES, CHILD_TABLES } from '../src/lib/famdb';

let pass = 0, fail = 0;
function t(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

console.log('— scoring —');
t('nhóm B đúng giờ = 2 sao', pointsForInstance('B', true) === 2);
t('nhóm B trễ = 1 sao (vẫn làm!)', pointsForInstance('B', false) === 1);
t('nhóm A = 0 sao (không gắn sao việc đã thích)', pointsForInstance('A', true) === 0);
t('nhóm A trễ cũng 0', pointsForInstance('A', false) === 0);

// streak mềm: 5 ngày tốt liên tiếp (trước hôm nay) = 5
t('streak 5 ngày liên tiếp', softStreak(['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02'], '2026-10-07') === 5);
// miss đúng 1 ngày → KHÔNG reset (Lally)
t('streak mềm: bỏ 1 ngày vẫn giữ', softStreak(['2026-10-06', '2026-10-05', '2026-10-03', '2026-10-02'], '2026-10-07') === 4);
// miss 2 ngày liên tiếp → reset
t('streak đứt khi 2 ngày trống liên tiếp', softStreak(['2026-10-06', '2026-10-03', '2026-10-02'], '2026-10-07') === 1);

// tốt nghiệp: ≥80% đúng giờ 4 tuần, ≥10 ngày
const hist: { date: string; done: boolean; onTime: boolean }[] = [];
for (let i = 1; i <= 20; i++) hist.push({ date: `2026-09-${String(i + 10).padStart(2, '0')}`, done: true, onTime: i % 5 !== 0 }); // 16/20 = 80%
t('tốt nghiệp đủ 80% + 10 ngày', graduationEligible(hist, '2026-10-07'));
const hist70 = Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 11).padStart(2, '0')}`, done: true, onTime: i < 7 })); // 7/10 = 70%
t('không tốt nghiệp khi 70%', !graduationEligible(hist70, '2026-10-07'));
t('không tốt nghiệp khi chưa đủ 10 ngày', !graduationEligible(hist70.slice(0, 8), '2026-10-07'));

console.log('— feedback (MÔ TẢ, KHÔNG ĐÁNH GIÁ) —');
const fb1 = renderFeedback({ title: 'Tự đánh răng', time: '06:38', onTime: true, firstTime: true });
t('khen mô tả có giờ thật', fb1.includes('06:38'));
t('không chứa "giỏi quá"', !checkBanned(fb1).length);
const fb2 = renderFeedback({ title: 'Tự đánh răng', time: '07:10', onTime: false, minutesLate: 15 });
t('trễ giờ: vẫn khích lệ, có "mai"', fb2.toLowerCase().includes('mai') && fb2.includes('TỰ'));
t('trễ giờ: không phạt', !/điền|phạt|thất bại/i.test(fb2));
const fb3 = renderFeedback({ title: 'Đọc sách', time: '20:15', onTime: true, groupA: true });
t('nhóm A: chỉ mô tả, không sao', !fb3.includes('sao') || !fb3.includes('+'));
const all = [fb1, fb2, fb3];
t('mọi feedback đều qua check từ cấm', all.every((f) => checkBanned(f).length === 0));
t('checkBanned bắt được khen đánh giá', checkBanned('Con giỏi quá!').length > 0);

console.log('— pomodoro (Premack + screen hygiene) —');
t('20′ làm → 5′ quà: hợp lệ', validatePomodoro(20, 5, 10) === null);
t('40′ làm → 10′ quà: hợp lệ', validatePomodoro(40, 10, 10) === null);
t('20′ làm → 15′ quà: quá nửa thời gian làm → chặn', validatePomodoro(20, 15, 10) !== null);
t('quà vượt trần Admin (10′) → chặn', validatePomodoro(40, 12, 10) !== null);
t('làm 3 phút → chặn (tối thiểu 5)', validatePomodoro(3, 1, 10) !== null);
const base = { status: 'running', work_ends_at: new Date(Date.now() + 10 * 60000).toISOString(), reward_started_at: null, reward_ends_at: null };
t('đang trong giờ làm → phase work', phaseOf(base, new Date()) === 'work');
t('hết giờ làm chưa nhận quà → work-done', phaseOf({ ...base, work_ends_at: new Date(Date.now() - 1000).toISOString() }, new Date()) === 'work-done');
const reward = { status: 'running', work_ends_at: new Date(Date.now() - 60000).toISOString(), reward_started_at: new Date(Date.now() - 60000).toISOString(), reward_ends_at: new Date(Date.now() + 60000).toISOString() };
t('đang xem quà → reward', phaseOf(reward, new Date()) === 'reward');
t('hết quà → reward-done (không autoplay mãi)', phaseOf({ ...reward, reward_ends_at: new Date(Date.now() - 1000).toISOString() }, new Date()) === 'reward-done');
t('đóng phiên → none', phaseOf({ ...reward, status: 'completed' }, new Date()) === 'none');
t('fmtCountdown 65s → 01:05', fmtCountdown(65000) === '01:05');

console.log('— pet (tamagotchi guardrails) —');
const H = 3600000;
// hunger decay, không tăng giờ ngủ (21h–6h)
const t9h = new Date('2026-10-02T09:00:00');
const t12h = new Date('2026-10-02T12:00:00');
t('awakeHours 9h→12h = 3h', Math.abs(awakeHours(t9h, t12h) - 3) < 0.01);
const t20h = new Date('2026-10-02T20:00:00');
const t22h = new Date('2026-10-02T22:00:00');
t('awakeHours 20h→22h = 1h (pet ngủ từ 21h)', Math.abs(awakeHours(t20h, t22h) - 1) < 0.01);
const stats = computeStats({ born_at: '2026-10-01T09:00:00', hatched_at: '2026-10-02T09:00:00', last_fed_at: '2026-10-02T09:00:00', last_play_at: '2026-10-02T09:00:00' }, new Date('2026-10-02T12:00:00'));
t('hunger 3h sau ăn = 100-27 = 73', Math.round(stats.hunger) === 73);
t('stage baby (1 ngày tuổi)', stats.stage === 'baby');
const egg = computeStats({ born_at: '2026-10-01T09:00:00', hatched_at: null, last_fed_at: '2026-10-01T09:00:00', last_play_at: '2026-10-01T09:00:00' }, new Date('2026-10-02T10:00:00'));
t('chưa hatch → stage egg', egg.stage === 'egg');
t('trứng đủ 24h → ready', eggReady('2026-10-01T10:00:00', new Date('2026-10-02T10:00:00')) === true);
t('pet ngủ ban đêm → mood ok (không kêu cứu lúc ngủ)', computeStats({ born_at: '2026-09-25T09:00:00', hatched_at: '2026-09-26T09:00:00', last_fed_at: '2026-10-01T09:00:00', last_play_at: '2026-10-01T09:00:00' }, new Date('2026-10-02T22:30:00')).mood === 'ok');
const speak = petSpeak('Mèo Mướp', { hunger: 20, happiness: 80, stage: 'teen', ageDays: 5, sleeping: false, mood: 'hungry' } as any, 'Bé');
t('kêu cứu đói = nhẹ nhàng, gợi nhiệm vụ', speak.includes('nhiệm vụ') && !/hết|chết|bị phạt/i.test(speak));
t('chơi cooldown 20 phút', canPlay(new Date(Date.now() - 10 * 60000).toISOString(), new Date()) === false && canPlay(new Date(Date.now() - 21 * 60000).toISOString(), new Date()) === true);
t('grown sau 14 ngày', computeStats({ born_at: '2026-09-01T09:00:00', hatched_at: '2026-09-02T09:00:00', last_fed_at: new Date().toISOString(), last_play_at: new Date().toISOString() }, new Date()).stage === 'grown');

console.log('— nhiệm vụ extra (claim phải có ảnh) —');
t('claim KHÔNG ảnh → từ chối', !isValidClaimPhoto(undefined) && !isValidClaimPhoto('') && !isValidClaimPhoto(null));
t('claim text thường → từ chối', !isValidClaimPhoto('làm rồi nha'));
t('claim ảnh jpeg base64 → hợp lệ', isValidClaimPhoto('data:image/jpeg;base64,/9j/4AAQ'));
t('claim ảnh png base64 → hợp lệ', isValidClaimPhoto('data:image/png;base64,iVBORw0KGgo'));
t('data URL không phải ảnh → từ chối', !isValidClaimPhoto('data:text/html;base64,PGh0bWw+'));

console.log('— journal audio (magic bytes, iOS-safe) —');
t('webm/EBML → webm', detectAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]))?.ext === 'webm');
t('mp4 (ftyp) → m4a', detectAudio(Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(4)]))?.ext === 'm4a');
t('ogg → ogg', detectAudio(Buffer.from('OggS123'))?.ext === 'ogg');
t('mp3 ID3 → mp3', detectAudio(Buffer.from('ID3\x04\x00'))?.ext === 'mp3');
t('rác → null (từ chối)', detectAudio(Buffer.from('<html>hello')) === null);
t('buffer rỗng → null', detectAudio(Buffer.alloc(0)) === null);

console.log('— famdb scoped layer (chống lộ chéo gia đình) —');
t('bắt query chạm bảng scoped', touchesScopedTable('SELECT * FROM point_ledger WHERE date=?') === 'point_ledger');
t('không bắt tên bảng làm tiền tố cột', touchesScopedTable('SELECT point_ledger_note FROM x') === null);
t('point_ledger đòi child_id', requiredScope('point_ledger') === 'child_id');
t('videos đòi family_id', requiredScope('videos') === 'family_id');
t('users không scoped ở famdb (auth tự quản)', requiredScope('users') === null);
let threw = false; try { assertScoped('SELECT * FROM daily_instances WHERE date=?'); } catch { threw = true; }
t('assertScoped NÉM khi query thiếu child_id', threw);
threw = false; try { assertScoped('SELECT * FROM daily_instances WHERE date=? AND child_id=?'); } catch { threw = true; }
t('assertScoped PASS khi có child_id', !threw);
threw = false; try { assertScoped('SELECT * FROM videos WHERE family_id=?'); } catch { threw = true; }
t('assertScoped PASS khi bảng family có family_id', !threw);
t('mọi bảng scoped khai báo đúng 2 nhóm', FAMILY_TABLES.length === 12 && CHILD_TABLES.length === 15 && !FAMILY_TABLES.some((x) => CHILD_TABLES.includes(x)));

console.log('— batch6 T3: colorbook prompt sanitizer —');
t('sanitize: trim + cap 200 ký tự', sanitizePrompt('  ' + 'a'.repeat(300) + '  ').length === 200);
t('sanitize: giữ nguyên prompt ngắn hợp lệ', sanitizePrompt('  con mèo đội mũ  ') === 'con mèo đội mũ');

console.log('— 10/10: chụp ảnh → tranh chibi (prompt + magic bytes) —');
// contract prompt TIẾNG VIỆT (11/10: English bị Gemini web chặn response rỗng)
t('chibiPrompt: là tranh tô màu (viền đen dày, nền trắng, không tô màu)', /viền đen dày/.test(chibiPrompt()) && /nền trắng/.test(chibiPrompt()) && /không tô màu/.test(chibiPrompt()));
t('chibiPrompt: khai báo mục đích tư gia (chống banned-quyền)', /tập tô màu ở nhà/.test(chibiPrompt()) && /không phải sản phẩm thương mại/.test(chibiPrompt()));
t('chibiPrompt: chibi đơn giản, nhiều khoảng trống cho bé 6 tuổi', /chibi/.test(chibiPrompt()) && /khoảng trống/.test(chibiPrompt()) && /6 tuổi/.test(chibiPrompt()));
t('isJpegOrPng: nhận JPEG (FFD8FF)', isJpegOrPng(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])) === true);
t('isJpegOrPng: nhận PNG (89504E47)', isJpegOrPng(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])) === true);
t('isJpegOrPng: từ chối text/html giả ảnh', isJpegOrPng(Buffer.from('<html>fake.jpg')) === false);
t('isJpegOrPng: từ chối buffer rỗng', isJpegOrPng(Buffer.alloc(0)) === false);

console.log('— batch6 T4: piano — 5 bài thiếu nhi hợp lệ, nằm trong quãng đàn C4-C5 —');
t('5 bài seed đều qua validateSong (midi/bpm/note count)', SONGS.every((s) => validateSong(s) === null));
t('mọi nốt của mọi bài nằm trong quãng đàn trên màn hình (60-72)', SONGS.every((s) => s.notes.every((n) => n.midi >= 60 && n.midi <= 72)));
t('validateSong bắt bài rác (nốt ngoài quãng)', validateSong({ id: 'x', title: 'x', emoji: 'x', bpm: 100, notes: Array.from({ length: 8 }, () => ({ midi: 90, beats: 1 })) }) !== null);

console.log('— batch6 T2: huy hiệu mốc chuỗi ngày tốt —');
t('streak 2 → chưa có huy hiệu nào', streakBadges(2).length === 0);
t('streak 3 → huy hiệu [3]', JSON.stringify(streakBadges(3)) === '[3]');
t('streak 8 → huy hiệu [3,7]', JSON.stringify(streakBadges(8)) === '[3,7]');
t('streak 30+ → đủ cả 3 huy hiệu [3,7,30]', JSON.stringify(streakBadges(45)) === '[3,7,30]');
t('streak mềm: bỏ 1 ngày vẫn giữ (đã test ở scoring)', softStreak(['2026-10-09', '2026-10-07'], '2026-10-10') === 2);

console.log('— batch6: idle-expire + TV-off (cơ chế thoát phiên Giải trí) —');
const MIN = 60000;
const t0 = new Date('2026-10-10T10:00:00Z');
const at = (min: number) => new Date(t0.getTime() + min * MIN);
const baseS = {
  status: 'running', kind: 'ticket',
  work_ends_at: t0.toISOString(), reward_started_at: t0.toISOString(), first_play_at: null as string | null,
};
t('vé mua 30′ chưa xem → idle-expire TẮT', idleExpired(baseS, at(IDLE_EXPIRE_MIN)) === true);
t('vé mua 29′ chưa xem → vẫn còn quyền', idleExpired(baseS, at(IDLE_EXPIRE_MIN - 1)) === false);
t('vé ĐÃ xem → KHÔNG BAO GIỜ bị idle tắt (countdown gốc quyết)', idleExpired({ ...baseS, first_play_at: at(5).toISOString() }, at(IDLE_EXPIRE_MIN + 60)) === false);
t('phiên đóng rồi → không idle', idleExpired({ ...baseS, status: 'completed' }, at(IDLE_EXPIRE_MIN)) === false);
const pomoS = { status: 'running', kind: 'pomodoro', work_ends_at: t0.toISOString(), reward_started_at: null, first_play_at: null };
t('pomodoro work-done 30′ không nhận quà → đóng (hết quyền)', idleExpired(pomoS, at(IDLE_EXPIRE_MIN)) === true);
t('pomodoro đang làm (chưa tới work_ends) → không đóng', idleExpired(pomoS, at(-5)) === false);
t('pomodoro đã claim (neo reward_started_at) 30′ chưa xem → đóng', idleExpired({ ...baseS, kind: 'pomodoro' }, at(IDLE_EXPIRE_MIN)) === true);
const castS = { status: 'running', cast_atv_at: t0.toISOString(), tv_off_at: null as string | null, reward_ends_at: at(15).toISOString() };
t('TV cast, hết reward + grace 10′ → L1 tự tắt', tvOverdue(castS, at(25 + 1)) === true);
t('TV cast, trong grace → chưa tắt', tvOverdue(castS, at(24)) === false);
t('TV đã tắt rồi (tv_off_at) → không lặp lệnh', tvOverdue({ ...castS, tv_off_at: at(20).toISOString() }, at(40)) === false);
t('phiên KHÔNG cast TV → hoàn toàn không đụng TV', tvOverdue({ status: 'running', cast_atv_at: null, tv_off_at: null, reward_ends_at: at(10).toISOString() }, at(60)) === false);

console.log('— quản lý mẫu tranh tô màu AI: rename / reorder / xóa file an toàn —');
t('safeTitle: trim + gộp khoảng trắng', safeTitle('  Bạch   Tuyết ') === 'Bạch Tuyết');
t('safeTitle: cap 60 ký tự', safeTitle('a'.repeat(100)).length === 60);
t('safeTitle: chuỗi rỗng → \'\' (API từ chối)', safeTitle('   ') === '');
t('safeTitle: null/undefined không đổ', safeTitle(null) === '' && safeTitle(undefined) === '');
t('moveId: kéo id giữa lên 1 bậc', JSON.stringify(moveId([5, 11, 9], 11, -1)) === '[11,5,9]');
t('moveId: kéo id đầu lên → null (không di chuyển)', moveId([5, 11], 5, -1) === null);
t('moveId: kéo id cuối xuống → null', moveId([5, 11], 11, 1) === null);
t('moveId: id không có trong list → null', moveId([5, 11], 99, 1) === null);
t('moveId: không đổi mảng gốc', (() => { const a = [1, 2, 3]; moveId(a, 1, 1); return JSON.stringify(a) === '[1,2,3]'; })());
t('isSafeColorbookRel: ảnh colorbook chuẩn (date-dir + prefix) → xóa được', isSafeColorbookRel('2026-10-11/colorbook-ab12cd34.png') === true);
t('isSafeColorbookRel: ảnh check-in (prefix ph) → KHÔNG xóa', isSafeColorbookRel('2026-10-11/ph-ab12cd34.jpg') === false);
t('isSafeColorbookRel: ảnh nguồn chụp (colorsrc) → KHÔNG xóa', isSafeColorbookRel('2026-10-11/colorsrc-ab12cd34.jpg') === false);
t('isSafeColorbookRel: path traversal → KHÔNG xóa', isSafeColorbookRel('../../etc/passwd') === false);
t('isSafeColorbookRel: thiếu thư mục ngày → KHÔNG xóa', isSafeColorbookRel('colorbook-ab12cd34.png') === false);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
