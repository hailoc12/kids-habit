'use client';
// F07 — Lịch: THÁNG (mặc định) + tuần toggle — con "nhìn thấy thời gian", tự đếm ngày
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7));
  const [mdata, setMdata] = useState<any>(null);
  const [wdata, setWdata] = useState<any>(null);
  const [tt, setTt] = useState<{ rows: any[]; today: number } | null>(null);
  const [dayDetail, setDayDetail] = useState<{ date: string; items: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [cdata, setCdata] = useState<any>(null);

  useEffect(() => {
    fetch('/api/timetable').then((r) => r.json()).then(setTt).catch(() => {});
    fetch('/api/classes', { cache: 'no-store' }).then((r) => r.json()).then(setCdata).catch(() => {});
  }, []);

  const loadMonth = useCallback((m: string) => {
    fetch(`/api/calendar?month=${m}`).then((r) => r.json()).then(setMdata);
  }, []);
  useEffect(() => { if (view === 'month') loadMonth(month); }, [view, month, loadMonth]);
  useEffect(() => { if (view === 'week') fetch('/api/calendar').then((r) => r.json()).then(setWdata); }, [view]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  async function openDay(date: string) {
    setLoadingDetail(true);
    const r = await fetch(`/api/today?date=${date}`);
    const j = await r.json();
    setDayDetail({ date, items: j.items });
    setLoadingDetail(false);
  }

  const [yy, mm] = month.split('-').map(Number);
  const label = `${MONTHS[mm - 1]} ${yy}`;

  return (
    <Shell>
      <div className="p-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-2xl lg:text-4xl font-extrabold text-star-deep">📅 {view === 'month' ? label : `Tuần ${wdata?.monday || ''}`}</h1>
          <div className="flex gap-2">
            <button onClick={() => setView(view === 'month' ? 'week' : 'month')}
              className="bg-white border-2 border-star/40 text-star-deep font-bold rounded-2xl px-4 py-2 text-sm lg:text-base">
              Xem {view === 'month' ? 'theo tuần' : 'cả tháng'}
            </button>
            {view === 'month' && (
              <span className="flex gap-1">
                <button onClick={() => shiftMonth(-1)} className="bg-white border-2 border-star/40 rounded-2xl w-11 h-11 lg:w-12 lg:h-12 text-xl font-bold text-star-deep">‹</button>
                <button onClick={() => shiftMonth(1)} className="bg-white border-2 border-star/40 rounded-2xl w-11 h-11 lg:w-12 lg:h-12 text-xl font-bold text-star-deep">›</button>
              </span>
            )}
          </div>
        </div>

        {view === 'month' ? (
          !mdata ? <p className="text-gray-400 p-6 text-center text-lg">Đang tải…</p> : (
            <>
              {mdata.streak > 2 && null /* streak ở view tuần */}
              <div className="grid grid-cols-7 gap-1.5 lg:gap-3 mt-4">
                {DOW.map((d) => <p key={d} className="text-center text-[11px] lg:text-sm font-bold text-gray-400">{d}</p>)}
                {Array.from({ length: mdata.firstDow }).map((_, i) => <div key={`e${i}`} />)}
                {mdata.days.map((d: any) => {
                  const isToday = d.date === mdata.today;
                  const isFuture = d.date > mdata.today;
                  return (
                    <button key={d.date} onClick={() => openDay(d.date)}
                      className={`rounded-2xl bg-white p-1.5 lg:p-3 min-h-16 lg:min-h-24 shadow-sm text-left transition
                        ${isToday ? 'ring-4 ring-star' : ''} ${isFuture ? 'opacity-40' : 'hover:shadow-md'}`}>
                      <p className={`text-xs lg:text-lg font-bold ${isToday ? 'text-star-deep' : 'text-gray-500'}`}>{Number(d.date.slice(8))}</p>
                      {d.stars > 0 && <p className="text-[10px] lg:text-xs text-star-deep font-bold">⭐{d.stars}</p>}
                      {d.done > 0 && <p className="text-[10px] lg:text-xs text-gray-400 font-semibold">{d.done}/{d.total}✓</p>}
                      {d.selfRated && <p className="text-[10px] lg:text-xs">😊</p>}
                      {d.events.map((e: any) => (
                        <p key={e.id} className="text-[9px] lg:text-xs text-blue-600 font-bold leading-tight truncate">{e.icon} {e.title}</p>
                      ))}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs lg:text-sm text-gray-400 mt-4 leading-relaxed">
                Chạm vào một ngày để xem con đã làm gì ngày đó nhé. Ô viền vàng là hôm nay.
              </p>
              <ClassesBlock cdata={cdata} reload={() => fetch('/api/classes', { cache: 'no-store' }).then((r) => r.json()).then(setCdata)} />
              <Timetable tt={tt} />
            </>
          )
        ) : (
          !wdata ? <p className="text-gray-400 p-6 text-center text-lg">Đang tải…</p> : (
            <div className="mt-4">
              {wdata.streak > 2 && <p className="text-sm lg:text-base font-bold text-star-deep mb-2">🔥 Chuỗi {wdata.streak} ngày làm tốt!</p>}
              <div className="grid grid-cols-7 gap-1.5 lg:gap-3">
                {wdata.days.map((d: string, idx: number) => {
                  const evts = (wdata.events || []).filter((e: any) => e.date === d);
                  const items = wdata.perDay[d] || [];
                  const done = items.filter((i: any) => i.status === 'done').length;
                  return (
                    <div key={d} className={`rounded-2xl p-1.5 lg:p-3 min-h-24 bg-white shadow-sm`}>
                      <p className="text-[11px] lg:text-sm font-bold text-center text-gray-400">{idx < 7 ? DOW[(idx + 1) % 7] : ''}<br />{d.slice(8)}</p>
                      <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                        {items.slice(0, 8).map((i: any) => (
                          <span key={i.instanceId} className={`text-[13px] lg:text-lg ${i.status === 'done' ? '' : 'opacity-25 grayscale'}`}>{i.icon}</span>
                        ))}
                      </div>
                      {done > 0 && <p className="text-[9px] lg:text-xs text-center text-star-deep font-bold">{done}✓</p>}
                      {evts.map((e: any) => <p key={e.id} className="text-[9px] lg:text-xs text-center text-blue-600 font-bold mt-0.5 leading-tight">{e.icon} {e.title}</p>)}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* chi tiết 1 ngày */}
      {(dayDetail || loadingDetail) && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50" onClick={() => setDayDetail(null)}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-[2rem] p-5 max-h-[70vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {loadingDetail || !dayDetail ? <p className="text-gray-400 text-center p-4">Đang tải…</p> : (
              <>
                <p className="text-lg lg:text-xl font-extrabold mb-3">📆 Ngày {dayDetail.date.split('-').reverse().join('/')}</p>
                <div className="space-y-2">
                  {dayDetail.items.map((i: any) => (
                    <div key={i.instanceId} className={`flex items-center gap-3 rounded-2xl p-2.5 ${i.status === 'done' ? 'bg-amber-50' : 'bg-gray-50 opacity-60'}`}>
                      <span className="text-2xl lg:text-3xl">{i.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm lg:text-base">{i.title}</p>
                        {i.status === 'done' && i.checkedAt && (
                          <p className="text-xs lg:text-sm text-star-deep font-semibold">
                            {new Date(i.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            {i.onTime ? ' · đúng giờ' : ' · trễ một chút'}
                          </p>
                        )}
                      </div>
                      {i.photoUrl && (// eslint-disable-next-line @next/next/no-img-element
                        <img src={i.photoUrl} alt="" className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl object-cover" />)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Thời khóa biểu tuần — cột hôm nay viền vàng, môn kèm icon */
function Timetable({ tt }: { tt: { rows: any[]; today: number } | null }) {
  if (!tt || !tt.rows?.length) return null;
  const days = [2, 3, 4, 5, 6, 7, 8].filter((d) => tt.rows.some((r) => r.weekday === d));
  const periods = Array.from(new Set(tt.rows.map((r) => r.period))).sort((a, b) => a - b);
  const byCell = (d: number, p: number) => tt.rows.find((r) => r.weekday === d && r.period === p);
  const WD_NAME: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };
  return (
    <section className="mt-6">
      <h2 className="font-extrabold text-star-deep text-lg lg:text-2xl mb-2">📚 Thời khóa biểu của con</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-[11px] text-gray-400">Tiết</th>
              {days.map((d) => (
                <th key={d} className={`text-xs lg:text-sm font-extrabold p-1 rounded-xl ${d === tt.today ? 'bg-star text-white' : 'text-gray-500'}`}>
                  {WD_NAME[d]}{d === tt.today ? ' · HÔM NAY' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p}>
                <td className="text-[11px] text-gray-400 font-bold text-center">{p}</td>
                {days.map((d) => {
                  const c = byCell(d, p);
                  return (
                    <td key={d} className={`bg-white rounded-xl p-1.5 lg:p-2 text-center shadow-sm ${d === tt.today ? 'ring-2 ring-star' : ''}`}>
                      {c ? <span className="text-xs lg:text-sm font-bold">{c.icon} {c.subject}</span> : <span className="text-gray-200 text-xs">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">Cột vàng là hôm nay — tối trước con xem sẵn mai học gì nhé!</p>
    </section>
  );
}


/* ───────── Lớp học thêm theo tuần + parent quản lý (strategy-classes) ───────── */
const DAYS = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function ClassesBlock({ cdata, reload }: { cdata: any; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ title: '', icon: '🎓', weekday: 2, start: '18:30', end: '19:30', startsOn: '', endsOn: '' });
  if (!cdata) return null;
  const classes: any[] = cdata.classes || [];

  async function act(body: any) {
    await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    reload();
    setAdding(false);
    setForm({ title: '', icon: '🎓', weekday: 2, start: '18:30', end: '19:30', startsOn: '', endsOn: '' });
  }

  return (
    <div className="mt-6 bg-gradient-to-r from-indigo-50 to-amber-50 rounded-[2rem] p-4 border-2 border-indigo-100">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-extrabold text-indigo-800">🎓 Lớp học thêm trong tuần</p>
        {cdata.isParent && (
          <div className="flex gap-2 items-center">
            <div className="flex bg-white rounded-full p-0.5 border border-indigo-100">
              {['auto_shift', 'parallel'].map((m) => (
                <button key={m} onClick={() => act({ action: 'set-mode', mode: m })}
                  className={`text-[10px] font-extrabold rounded-full px-2.5 py-1 ${cdata.mode === m ? 'bg-indigo-500 text-white' : 'text-gray-400'}`}>
                  {m === 'auto_shift' ? '⏩ tự dồn giờ' : '↔ song song'}
                </button>
              ))}
            </div>
            <button className="text-xs font-extrabold text-indigo-600 underline" onClick={() => setAdding(!adding)}>➕ thêm lớp</button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-indigo-400 font-bold mt-1">
        {cdata.mode === 'auto_shift' ? 'Việc tối bị trùng lớp sẽ TỰ DỒN xuống sau giờ học — con vẫn được tính đúng giờ.' : 'Việc hiển thị song song với lớp — bố mẹ tự sắp lại giờ.'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 mt-3">
        {[2, 3, 4, 5, 6, 7, 8].map((d) => {
          const ds = classes.filter((c: any) => c.weekday === d);
          return (
            <div key={d} className="bg-white rounded-2xl p-2.5 shadow-sm min-h-16">
              <p className="text-[10px] font-extrabold text-gray-300 uppercase">{DAYS[d]}</p>
              {ds.length === 0 ? <p className="text-[10px] text-gray-200 font-bold">—</p> : ds.map((c: any) => (
                <div key={c.id} className="mt-1 group">
                  <p className="text-xs font-extrabold text-ink leading-tight">{c.icon} {c.title}</p>
                  <p className="text-[10px] font-bold text-indigo-500">{c.start_hhmm}–{c.end_hhmm}</p>
                  {c.ends_on && <p className="text-[9px] text-gray-400 font-bold">đến {c.ends_on.slice(5)}</p>}
                  {cdata.isParent && (
                    <button className="text-[9px] text-red-300 font-bold hidden group-hover:inline" onClick={() => { if (confirm(`Bỏ lớp ${c.title}?`)) act({ action: 'delete', id: c.id }); }}>xóa</button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {adding && cdata.isParent && (
        <div className="mt-3 bg-white rounded-2xl p-3 space-y-2">
          <div className="flex gap-2">
            <input className="input !py-2 !text-sm w-14 text-center" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            <input className="input !py-2 !text-sm flex-1" placeholder="Tên lớp (vd: Cờ vua)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select className="input !py-2 !text-sm" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
              {[2, 3, 4, 5, 6, 7, 8].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
            </select>
            <input type="time" className="input !py-2 !text-sm" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <input type="time" className="input !py-2 !text-sm" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <input type="date" className="input !py-2 !text-sm flex-1" title="bắt đầu (bỏ trống = ngay)" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
            <input type="date" className="input !py-2 !text-sm flex-1" title="kết thúc (bỏ trống = lâu dài)" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
          </div>
          <button className="btn-primary w-full !py-2 !text-sm" disabled={!form.title} onClick={() => act({ action: 'create', ...form, childId: null })}>🎓 Thêm lớp</button>
        </div>
      )}
    </div>
  );
}
