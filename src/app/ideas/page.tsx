'use client';
// Góp ý App — Bé/bố mẹ báo lỗi, đề xuất cải tiến, gửi cảm ơn (con là co-founder)
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import VoiceInput from '@/components/VoiceInput';

const KINDS = [
  { key: 'idea', label: 'Đề xuất', emoji: '💡' },
  { key: 'bug', label: 'Báo lỗi', emoji: '🐛' },
  { key: 'improve', label: 'Cải tiến', emoji: '🔧' },
  { key: 'thanks', label: 'Cảm ơn', emoji: '❤️' },
];
const STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Bố đang đọc', cls: 'bg-amber-100 text-amber-700' },
  planned: { label: 'Sẽ làm nhé', cls: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'Đã có trong app! 🎉', cls: 'bg-green-100 text-green-700' },
  closed: { label: 'Chưa làm được', cls: 'bg-gray-100 text-gray-500' },
};

export default function IdeasPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [kind, setKind] = useState('idea');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/ideas', { cache: 'no-store' }).then((r) => r.json()).then((j) => setItems(j.items));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!title) return;
    await fetch('/api/ideas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, detail, kind }),
    });
    setTitle(''); setDetail('');
    setMsg('Cảm ơn con! Bố đọc từng góp ý hết nhé 💛');
    setTimeout(() => setMsg(''), 3500);
    load();
  }

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">📣 Góp ý App</h1>
        <p className="text-sm lg:text-lg text-gray-500 mt-1 mb-4">App này là của cả nhà — thấy gì chưa ốc thì nói bố sửa liền!</p>
        {msg && <p className="bg-amber-50 text-star-deep rounded-2xl p-3 text-sm lg:text-base font-bold mb-3">{msg}</p>}

        <div className="space-y-2 mb-6">
          {(items || []).map((i: any) => {
            const s = STATUS[i.status] || STATUS.proposed;
            const k = KINDS.find((x) => x.key === i.kind) || KINDS[0];
            return (
              <div key={i.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between gap-2 items-start">
                  <p className="font-bold"><span className="mr-1">{k.emoji}</span>{i.title}</p>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${s.cls}`}>{s.label}</span>
                </div>
                {i.detail && <p className="text-sm text-gray-500 mt-1">{i.detail}</p>}
              </div>
            );
          })}
          {items && items.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400">Chưa có góp ý nào — góp ý đầu tiên đi!</div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
          <p className="font-bold">Góp ý mới</p>
          <div className="flex gap-2 flex-wrap">
            {KINDS.map((k) => (
              <button key={k.key} onClick={() => setKind(k.key)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold ${kind === k.key ? 'bg-star text-white' : 'bg-amber-50 text-gray-500'}`}>
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
          <VoiceInput value={title} onChange={setTitle}
            placeholder={kind === 'bug' ? 'Thấy gì bị lỗi? (vd: bấm nút Vẽ không lên)' : kind === 'thanks' ? 'Con muốn cảm ơn điều gì?' : 'Con muốn app có gì?'} />
          <VoiceInput multiline value={detail} onChange={setDetail} placeholder="Kể thêm chút nữa… (hoặc bấm 🎤 để nói)" />
          <button className="btn-primary w-full" onClick={add} disabled={!title}>Gửi cho bố</button>
        </div>
      </div>
    </Shell>
  );
}
