'use client';
// F14 — Parent nhập bù sticker giấy sáng hôm sau
import { useCallback, useEffect, useState } from 'react';

export default function PaperLogPage() {
  const [date, setDate] = useState(new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const [items, setItems] = useState<any[]>([]);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [late, setLate] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState('');

  const load = useCallback((d: string) => {
    fetch(`/api/review?date=${d}`).then((r) => r.json()).then((j) => {
      setItems(j.items.filter((i: any) => i.status === 'pending'));
      setChecks({}); setLate({});
    });
  }, []);
  useEffect(() => { load(date); }, [date, load]);

  async function save() {
    const entries = Object.entries(checks).filter(([, v]) => v).map(([k]) => ({
      templateId: items.find((i) => i.instanceId === Number(k))?.templateId,
      done: true, onTime: !late[Number(k)],
    })).filter((e) => e.templateId);
    const res = await fetch('/api/paper-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, entries }),
    });
    const j = await res.json();
    setMsg(j.ok ? `Đã nhập ${j.recorded} việc từ sticker giấy.` : `Lỗi: ${j.error}`);
    load(date);
  }

  return (
    <div className="max-w-md mx-auto p-5">
      <h1 className="text-lg font-extrabold">📝 Nhập bù sticker giấy</h1>
      <input type="date" className="input my-3" value={date} onChange={(e) => setDate(e.target.value)} />
      {msg && <p className="bg-amber-50 text-star-deep rounded-xl p-2 text-sm font-bold mb-3">{msg}</p>}
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.instanceId} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <input type="checkbox" className="w-6 h-6 accent-amber-500" checked={!!checks[i.instanceId]}
              onChange={(e) => setChecks({ ...checks, [i.instanceId]: e.target.checked })} />
            <span className="text-xl">{i.icon}</span>
            <span className="font-bold text-sm flex-1">{i.title}</span>
            {checks[i.instanceId] && (
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={!!late[i.instanceId]} onChange={(e) => setLate({ ...late, [i.instanceId]: e.target.checked })} /> trễ
              </label>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Không còn việc nào cần nhập cho ngày này.</p>}
      </div>
      <button className="btn-primary w-full mt-4" onClick={save} disabled={!Object.values(checks).some(Boolean)}>Lưu</button>
      <p className="text-center mt-6"><a className="text-star-deep font-bold text-sm" href="/review">→ Đi duyệt ngày</a></p>
    </div>
  );
}
