'use client';
// F05 — Tự chấm sao cuối ngày + điều tự hào (talk less, ask more)
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';

export default function EndOfDay() {
  const [stars, setStars] = useState(0);
  const [proudText, setProudText] = useState('');
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    await fetch('/api/self-rating', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars, proudText }),
    });
    setSaved(true);
    setTimeout(() => router.push('/'), 2500);
  }

  return (
    <Shell>
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-star-deep mb-1">🌙 Kết thúc ngày</h1>
        <p className="text-gray-500 mb-6">Chỉ MỘT người biết hết ngày hôm nay của Bé: chính con.</p>

        <p className="font-bold mb-2">Hôm nay con chấm mình mấy sao?</p>
        <div className="flex gap-2 lg:gap-4 mb-8 justify-center lg:justify-start">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} className={`text-6xl lg:text-8xl transition ${n <= stars ? 'scale-110' : 'grayscale opacity-30'}`}>⭐</button>
          ))}
        </div>

        <p className="font-bold mb-2">Điều gì con thấy tự hào nhất?</p>
        <div className="mb-2"><VoiceInput multiline value={proudText} onChange={setProudText}
          placeholder="Hôm nay con tự hào nhất về… (hoặc bấm 🎤 để kể)" /></div>
        <p className="text-xs text-gray-400 mb-6">Con có thể kể bằng lời của con — bố mẹ chỉ đọc thôi.</p>

        <button className="btn-primary w-full" onClick={save} disabled={saved}>
          {saved ? 'Đã lưu! Chúc con ngủ ngon 🌙' : 'Gửi cho bố mẹ'}
        </button>
        {saved && <p className="text-center text-star-deep font-bold mt-4">Mai con kể phần nào khó nhất nha!</p>}
      </div>
    </Shell>
  );
}
