// Nuôi thú cưng — logic thuần (unit-test được)
// Guardrails: pet KHÔNG chết, KHÔNG khóc dằn vặt; ngủ 21h–6h (hunger không tăng);
// "kêu cứu" = lời hỏi nhẹ nhàng dẫn tới nhiệm vụ Extra (không phạt, không đáng sợ)

export const PET_RULES = {
  hungerPerHour: 9,      // no → đói sau ~11h thức (trừ giờ ngủ)
  happyPerHour: 5,       // vui giảm chậm hơn
  feedRestore: 55,       // mỗi bữa ăn +55 (tối đa 100)
  playRestore: 25,       // chơi +25
  playCooldownMin: 20,   // chơi lại sau 20'
  nightStart: 21, nightEnd: 6, // giờ ngủ của pet (khớp khung ngủ gia đình)
} as const;

/** số giờ THỨC giữa 2 thời điểm (bỏ khoảng 21h→6h) */
export function awakeHours(from: Date, to: Date): number {
  let h = 0;
  const cur = new Date(from);
  while (cur < to) {
    const stepEnd = new Date(Math.min(cur.getTime() + 15 * 60000, to.getTime()));
    const hr = cur.getHours();
    const asleep = hr >= PET_RULES.nightStart || hr < PET_RULES.nightEnd;
    if (!asleep) h += (stepEnd.getTime() - cur.getTime()) / 3600000;
    cur.setTime(stepEnd.getTime());
  }
  return h;
}

export type PetStats = { hunger: number; happiness: number; stage: 'egg' | 'baby' | 'teen' | 'grown'; ageDays: number; sleeping: boolean; mood: 'ok' | 'hungry' | 'bored' | 'need-help' };

export function computeStats(pet: { born_at: string; hatched_at: string | null; last_fed_at: string; last_play_at: string }, now: Date): PetStats {
  const born = new Date(pet.born_at);
  const ageDays = Math.max(0, (now.getTime() - born.getTime()) / 86400000);
  const hatched = pet.hatched_at ? new Date(pet.hatched_at) : null;
  const stage: PetStats['stage'] = !hatched
    ? 'egg'
    : ageDays < 3 ? 'baby' : ageDays < 14 ? 'teen' : 'grown';
  const hunger = clamp(100 - awakeHours(new Date(pet.last_fed_at), now) * PET_RULES.hungerPerHour);
  const happiness = clamp(100 - awakeHours(new Date(pet.last_play_at), now) * PET_RULES.happyPerHour);
  const hr = now.getHours();
  const sleeping = hr >= PET_RULES.nightStart || hr < PET_RULES.nightEnd;
  let mood: PetStats['mood'] = 'ok';
  if (!sleeping && hunger < 30 && happiness < 30) mood = 'need-help';
  else if (!sleeping && hunger < 30) mood = 'hungry';
  else if (!sleeping && happiness < 30) mood = 'bored';
  return { hunger, happiness, stage, ageDays, sleeping, mood };
}

/** trứng nở sau 24h kể từ lúc nhận nuôi (bài học kiên nhìn + chăm) */
export function eggReady(born_at: string, now: Date): boolean {
  return now.getTime() - new Date(born_at).getTime() >= 86400000;
}

/** lời pet "kêu cứu" — nhẹ nhàng, gợi nhiệm vụ, không đổ lỗi */
export function petSpeak(name: string, s: PetStats, childName: string): string {
  if (s.sleeping) return `${name} đang ngủ khì khì… sáng mai chơi tiếp nhé! 😴`;
  if (s.stage === 'egg') return `Trứng đang ấp… ${childName} chăm nó thêm chút nữa là nở!`;
  switch (s.mood) {
    case 'hungry': return `${name} đói bụng rồi… ${childName} làm một nhiệm vụ nhỏ mua đồ ăn giúp bạn nhé? 🥺`;
    case 'bored': return `${name} buồn quá… chơi với mình một chút đi! 🥺`;
    case 'need-help': return `${name} đói VÀ buồn… ${childName} giúp bạn nhé? Làm nhiệm vụ nhỏ là có sao mua đồ ăn! 💛`;
    default: return `${name} vui lắm! Cảm ơn ${childName} nha! 💛`;
  }
}

export function canPlay(last_play_at: string, now: Date): boolean {
  return now.getTime() - new Date(last_play_at).getTime() >= PET_RULES.playCooldownMin * 60000;
}

export function stageSize(stage: PetStats['stage']): number {
  return { egg: 0.7, baby: 0.85, teen: 1, grown: 1.2 }[stage];
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}
