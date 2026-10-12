// Dữ liệu bài hát cho /piano — giai điệu đơn 1 dòng, viết tay bằng nốt midi
// C4=60, C#4=61, D4=62, D#4=63, E4=64, F4=65, F#4=66, G4=67, G#4=68, A4=69, A#4=70, B4=71, C5=72
// beats = độ dài nốt (1 = 1 phách)
export interface SongNote { midi: number; beats: number }
export interface Song { id: string; title: string; emoji: string; bpm: number; notes: SongNote[] }

/** đổi midi → tần số Hz (A4 = 69 = 440Hz) */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** kiểm tra bài hợp lệ: midi 60..84 (C4..C6), bpm 40..200, tối thiểu 8 nốt — trả lỗi hoặc null */
export function validateSong(s: Song): string | null {
  if (s.bpm < 40 || s.bpm > 200) return `${s.title}: bpm ${s.bpm} ngoài khoảng 40..200`;
  if (s.notes.length < 8) return `${s.title}: cần ít nhất 8 nốt (hiện có ${s.notes.length})`;
  for (const nt of s.notes) {
    if (nt.midi < 60 || nt.midi > 84) return `${s.title}: midi ${nt.midi} ngoài quãng C4..C6 (60..84)`;
    if (!(nt.beats > 0)) return `${s.title}: nốt midi ${nt.midi} có beats <= 0`;
  }
  return null;
}

// viết gọn: n(67) = nốt G4 dài 1 phách
const n = (midi: number, beats = 1): SongNote => ({ midi, beats });

export const SONGS: Song[] = [
  // 🏁 BÀI DỄ NHẤT — đặt đầu danh sách
  {
    id: 'lap-lanh-tinh-tinh',
    title: 'Lấp Lánh Tinh Tinh',
    emoji: '⭐',
    bpm: 80,
    notes: [
      // C C G G A A G- | F F E E D D C- | G G F F E E D- | lặp câu 1 câu 2
      n(60), n(60), n(67), n(67), n(69), n(69), n(67, 2),
      n(65), n(65), n(64), n(64), n(62), n(62), n(60, 2),
      n(67), n(67), n(65), n(65), n(64), n(64), n(62, 2),
      n(60), n(60), n(67), n(67), n(69), n(69), n(67, 2),
      n(65), n(65), n(64), n(64), n(62), n(62), n(60, 2),
    ],
  },
  {
    id: 'kia-con-buom-vang',
    title: 'Kìa Con Bướm Vàng',
    emoji: '🦋',
    bpm: 92,
    notes: [
      // giai điệu Frère Jacques: C C D D | C C D D | E F G- | E F G- |
      // G A G F E C- (x2) | G G C- (x2)
      n(60), n(60), n(62), n(62),
      n(60), n(60), n(62), n(62),
      n(64), n(65), n(67, 2),
      n(64), n(65), n(67, 2),
      n(67), n(69), n(67), n(65), n(64), n(60, 2),
      n(67), n(69), n(67), n(65), n(64), n(60, 2),
      n(67), n(67), n(60, 2),
      n(67), n(67), n(60, 2),
    ],
  },
  {
    id: 'em-di-choi-thuyen',
    title: 'Em Đi Chơi Thuyền',
    emoji: '🚣',
    bpm: 80,
    notes: [
      // theo bản nốt chữ C (giọng Đô trưởng) — câu 1 tới câu 5 + câu kết
      n(67), n(67), n(67), n(60),
      n(67), n(69), n(67), n(64), n(67),
      n(65), n(65), n(69), n(62), n(62), n(69), n(67), n(60),
      n(60), n(65), n(60), n(65), n(60),
      n(69), n(67), n(67), n(67),
      n(69), n(71), n(67), n(69), n(69), n(69), n(67), n(72), n(72), n(72), n(72, 2),
    ],
  },
  {
    id: 'dem-ngon-tay',
    title: 'Đếm Ngón Tay',
    emoji: '✋',
    bpm: 100,
    notes: [
      // "Năm ngón tay ngoan" (Trần Văn Thụ) — bản đơn giản cho bé, mô-típ la-sol-mi
      n(69), n(69), n(67), n(64),
      n(69), n(69), n(67), n(64),
      n(67), n(69), n(67), n(64), n(67), n(69),
      n(67), n(64), n(62), n(60),
      n(69), n(69), n(67), n(64),
      n(69), n(69), n(67), n(64),
      n(67), n(69), n(67), n(64), n(67), n(69),
      n(67), n(64), n(62), n(64), n(60, 2),
    ],
  },
  {
    id: 'chu-voi-con',
    title: 'Chú Voi Con',
    emoji: '🐘',
    bpm: 96,
    notes: [
      // "Chú voi con ở Bản Đôn" (Phạm Tuyên) — bản dễ, khổ hát (tông La thứ / giọng Đô)
      // la sol fa fa do do fa | la do2 fa fa do do fa | re re re fa sol fa do | fa re re do do do do-
      n(69), n(67), n(65), n(65), n(60), n(60), n(65),
      n(69), n(72), n(65), n(65), n(60), n(60), n(65),
      n(62), n(62), n(62), n(65), n(67), n(65), n(60),
      n(65), n(62), n(62), n(60), n(60), n(60), n(60, 2),
    ],
  },
];
