// Seed data khởi tạo: 13 việc checklist Bé (từ Excel) + Kho quà Bí Mật (Phụ lục D PRD)
import db from '../src/lib/db';

// ===== 1. Checklist Bé — từ sheet "Checklist Bé" Excel 05-11/10/2026 =====
const TASKS = [
  // SÁNG — nhóm B (thói quen đang xây)
  { title: 'Dậy khi đồng hồ reo', icon: '⏰', section: 'sang', grp: 'B', from: '06:00', to: '06:10', note: 'bố gọi 1 lần (6h00)', sort: 1 },
  { title: 'Tự rửa mặt + tự mặc đồ', icon: '🧒', section: 'sang', grp: 'B', from: '06:00', to: '06:15', note: '', sort: 2 },
  { title: 'Ngồi ăn sáng đúng khung', icon: '🍚', section: 'sang', grp: 'B', from: '06:15', to: '06:40', note: 'cả nhà ăn cùng', sort: 3 },
  { title: 'Tự đánh răng', icon: '🦷', section: 'sang', grp: 'B', from: '06:40', to: '06:55', note: 'bố check camera 6h40', sort: 4 },
  { title: 'Tự kiểm tra cặp sách', icon: '🎒', section: 'sang', grp: 'B', from: '06:40', to: '06:59', note: '', sort: 5 },
  { title: 'Xuống sảnh đúng 7h00', icon: '🚶', section: 'sang', grp: 'B', from: '06:55', to: '07:00', note: 'xe đón 7h10', sort: 6 },
  // TỐI — nhóm B
  { title: 'Tự tắm', icon: '🚿', section: 'toi', grp: 'B', from: '17:30', to: '18:10', note: 'bố nhận ở sảnh 17h30', sort: 7 },
  { title: 'Ngồi ăn tối đúng khung', icon: '🍽', section: 'toi', grp: 'B', from: '18:15', to: '19:00', note: 'cả nhà ăn cùng', sort: 8 },
  { title: 'Tự học 19h00–19h45', icon: '📖', section: 'toi', grp: 'B', from: '19:00', to: '19:45', note: 'checkpoint mic 19h45',
    subtasks: [
      { id: 's1', title: 'Bấm đồng hồ, sắp sẵn đồ học', icon: '⏱' },
      { id: 's2', title: 'Bài tập về nhà / luyện viết, toán 30 phút', icon: '✏️' },
      { id: 's3', title: 'Sắp bài + cặp sách cho ngày mai', icon: '🎒' },
      { id: 's4', title: 'Tick checklist', icon: '✅' },
    ], sort: 9 },
  { title: 'Sắp cặp sách cho ngày mai', icon: '📅', section: 'toi', grp: 'B', from: '19:35', to: '19:45', note: '', sort: 10 },
  { title: 'Đọc sách ≥30 phút + ghi nhật ký', icon: '📚', section: 'toi', grp: 'A', from: '19:45', to: '21:00', note: 'mẹ check nhanh 20h30', sort: 11 },
  { title: 'Tự đánh răng 21h00', icon: '🦷', section: 'toi', grp: 'B', from: '21:00', to: '21:10', note: 'mẹ check răng (sticker giấy)', sort: 12 },
  { title: 'Đi ngủ trước 21h30', icon: '🌙', section: 'toi', grp: 'B', from: '21:10', to: '21:30', note: 'đèn tắt 21h20 (sticker giấy)', sort: 13 },
];

const insTask = db.prepare(`INSERT OR IGNORE INTO task_templates (title, icon, section, grp, target_from, target_to, parent_note, subtasks, sort) VALUES (?,?,?,?,?,?,?,?,?)`);
const count = (db.prepare(`SELECT COUNT(*) c FROM task_templates`).get() as any).c;
if (count === 0) {
  for (const t of TASKS) {
    insTask.run(t.title, t.icon, t.section, t.grp, t.from, t.to, t.note, JSON.stringify(t.subtasks || []), t.sort);
  }
  console.log(`✓ Seed ${TASKS.length} việc checklist (đọc sách = nhóm A, không sao)`);
} else console.log('• task_templates đã có dữ liệu, bỏ qua');

// ===== 2. Kho Quà Bí Mật — từ Phụ lục D (địa điểm Hà Nội + sách) =====
const GIFTS: [string, string, string, string, string][] = [
  ['outing', 'Bảo tàng Dân tộc học — phòng khám phá + múa rối nước', 'Cầu Giấy', '10–40k, rối nước 70–90k', 'trò dân gian ngoài trời; đóng T2'],
  ['outing', 'Bảo tàng Thiên nhiên — khủng long & hóa thạch', 'Cầu Giấy', 'miễn phí', 'đóng T2+CN'],
  ['outing', 'Bảo tàng Vũ trụ + Tháp Thiên văn', 'Hòa Lạc (~40km)', '84–200k', 'con tự làm thí nghiệm — dã ngoại nửa ngày'],
  ['outing', 'Công viên Thống Nhất — tàu tuổi thơ', 'Hai Bà Trưng', '30k/tàu', 'tàu mini từ 1978 + đạp vịt'],
  ['outing', 'Thung lũng hoa Hồ Tây', 'Tây Hồ', '30–50k', 'có khu trẻ em'],
  ['outing', 'Cánh đồng cỏ lau hồ Tây (mùa thu)', 'Tây Hồ', 'miễn phí', 'picnic + chụp ảnh gia đình — đỉnh tháng 10'],
  ['outing', 'Detrang Farm — cho động vật ăn, vắt sữa', 'Ba Vì', '150–300k', 'trải nghiệm giáo dục'],
  ['outing', 'Ba Vì Eco Camping + đồi Đông Cao', 'Ba Vì', '50–320k', 'cắm trại thu, lửa trại mini'],
  ['outing', 'Lớp làm bánh cuối tuần', 'Beemart Cầu Giấy', '200–400k', 'trải nghiệm "đầu bếp" 1 buổi'],
  ['outing', 'Xem phim hoạt hình suất sáng', 'BHD/Lotte', '55–95k', 'về kịp ngủ 21h30'],
  ['book', 'Doraemon sách tranh (Túi thần kì…)', 'Kim Đồng', '~31.5k', 'chữ to — khởi động giai đoạn mới đọc'],
  ['book', 'Chú Vịt Xám — Bé Tập Kể Chuyện', 'NXB Trẻ', '~20–25k', '16 trang — đọc xong 1 cuốn trong 5-10 phút'],
  ['book', 'Nhóc Maruko', 'Kim Đồng', '~16.5–40k/tập', 'nữ chính bé tiểu học'],
  ['book', 'Bé học làm người (tranh Hàn 4–6 tuổi)', 'Kim Đồng', '~69k', 'cảm xúc & kỹ năng sống'],
  ['book', 'Mười Vạn Câu Hỏi Vì Sao — Thiên nhiên kỳ thú', 'Kim Đồng', '60–70k', 'kiến thức, câu–đáp ngắn'],
  ['book', 'Thỏ Bảy Màu', 'Saigon Books', '~81k', 'truyện tranh hài Việt'],
  ['book', 'Room on the Broom — Julia Donaldson', 'Fahasa', '99–105k', 'nữ chính, thơ vần tiếng Anh'],
  ['book', 'Usborne Phonics Readers (Fat Cat on a Mat…)', 'Usborne', '90–150k/cuốn', 'chuẩn phonics tiếng Anh'],
  ['small', 'Kem + đi công viên 1 buổi', 'gần nhà', '~30k', 'phản hồi tức thì'],
  ['small', 'Chọn phim cả nhà xem tối T7', 'nhà', '0k', 'quyền chọn — autonomy'],
];
const gCount = (db.prepare(`SELECT COUNT(*) c FROM gifts`).get() as any).c;
if (gCount === 0) {
  const ins = db.prepare(`INSERT INTO gifts (type, title, area, cost_note, note) VALUES (?,?,?,?,?)`);
  for (const g of GIFTS) ins.run(...(g as any));
  console.log(`✓ Seed ${GIFTS.length} quà trong Kho Bí Mật`);
} else console.log('• gifts đã có dữ liệu, bỏ qua');

// ===== 3. Cửa hàng (pet + đồ ăn + vé YouTube) & Nhiệm vụ Extra =====
const SHOP: [string, string, string, string, number, string][] = [
  ['pet', 'chicken', 'Gà Mèn', '🐔', 0, '{}'],
  ['pet', 'cat', 'Mèo Mướp', '🐱', 20, '{}'],
  ['pet', 'bunny', 'Thỏ Trắng', '🐰', 35, '{}'],
  ['pet', 'dog', 'Cún Cưng', '🐶', 50, '{}'],
  ['pet', 'hamster', 'Chuột Hamster', '🐹', 50, '{}'],
  ['pet', 'turtle', 'Rùa Vàng', '🐢', 40, '{}'],
  ['pet', 'unicorn', 'Kỳ Lân Tuyết', '🦄', 120, '{}'],
  ['pet', 'dragon', 'Rồng Con', '🐲', 150, '{}'],
  ['food', '', 'Ngũ cốc', '🌾', 1, '{}'],
  ['food', '', 'Cà rốt', '🥕', 2, '{}'],
  ['food', '', 'Táo đỏ', '🍎', 2, '{}'],
  ['food', '', 'Bánh kem', '🍰', 5, '{}'],
  ['ytticket', '', 'Vé YouTube 10 phút', '🎬', 5, '{"minutes":10}'],
  ['ytticket', '', 'Vé YouTube 15 phút', '📺', 8, '{"minutes":15}'],
  ['ytticket', '', 'Vé YouTube 30 phút', '🎟', 15, '{"minutes":30}'],
];
const sCount = (db.prepare(`SELECT COUNT(*) c FROM shop_items`).get() as any).c;
if (sCount === 0) {
  const ins = db.prepare(`INSERT INTO shop_items (kind, code, title, emoji, price, payload) VALUES (?,?,?,?,?,?)`);
  for (const s of SHOP) ins.run(...(s as any));
  console.log(`✓ Seed ${SHOP.length} món cửa hàng (gà đầu MIỄN PHÍ — pet bạn đầu tiên)`);
} else console.log('• shop_items đã có dữ liệu, bỏ qua');

const MISSIONS: [string, string, number][] = [
  ['Đọc sách thêm 15 phút (ngoài khung thường)', '📖', 3],
  ['Dọn đồ chơi gọn gàng', '🧹', 2],
  ['Giúp mẹ chuẩn bị bữa ăn', '👩‍🍳', 3],
  ['Tưới cây trong nhà', '🪴', 2],
  ['Tự gấp quần áo của con', '👕', 2],
  ['Giúp bố mang đồ xuống xe', '🚗', 2],
];
const mCount = (db.prepare(`SELECT COUNT(*) c FROM extra_missions`).get() as any).c;
if (mCount === 0) {
  const ins = db.prepare(`INSERT INTO extra_missions (title, icon, stars) VALUES (?,?,?)`);
  for (const m of MISSIONS) ins.run(...(m as any));
  console.log(`✓ Seed ${MISSIONS.length} nhiệm vụ Extra`);
} else console.log('• extra_missions đã có dữ liệu, bỏ qua');

// ===== 4. Thời khóa biểu (lớp 1 buổi sáng — theo ảnh + bố chỉnh được trong Admin) =====
const TT: [number, number, string, string][] = [
  // [weekday (2=T2), tiết, môn, icon]
  [2, 1, 'Toán', '➕'], [2, 2, 'Tiếng Việt', '📖'], [2, 3, 'Tiếng Việt', '📖'], [2, 4, 'Thể dục', '🏃'],
  [3, 1, 'Tiếng Việt', '📖'], [3, 2, 'Toán', '➕'], [3, 3, 'Toán', '➕'], [3, 4, 'Âm nhạc', '🎵'],
  [4, 1, 'Tiếng Việt', '📖'], [4, 2, 'Tiếng Việt', '📖'], [4, 3, 'Mĩ thuật', '🎨'], [4, 4, 'Toán', '➕'],
  [5, 1, 'Toán', '➕'], [5, 2, 'Tiếng Việt', '📖'], [5, 3, 'Tiếng Anh', '🔤'], [5, 4, 'Thể dục', '🏃'],
  [6, 1, 'Tiếng Việt', '📖'], [6, 2, 'Toán', '➕'], [6, 3, 'Đạo đức', '💛'], [6, 4, 'Trải nghiệm', '🌱'],
];
const ttCount = (db.prepare(`SELECT COUNT(*) c FROM timetable`).get() as any).c;
if (ttCount === 0) {
  const ins = db.prepare(`INSERT INTO timetable (weekday, period, subject, icon) VALUES (?,?,?,?)`);
  for (const r of TT) ins.run(...(r as any));
  console.log(`✓ Seed thời khóa biểu T2–T6 (T4 Mĩ thuật, T5 Tiếng Anh — bố sửa được trong Admin)`);
} else console.log('• timetable đã có dữ liệu, bỏ qua');

// ===== 5. Bài học Tư Duy (Wikipedia mini cho bé) =====
const LESSONS = [
  {
    slug: 'ky-luat-ca-nhan', title: 'Kỷ luật cá nhân', icon: '🛡️', category: 'Tư duy', sort: 1,
    summary: 'Kỷ luật là tự mình làm điều đúng, ngay cả khi không ai nhìn.',
    intro: 'Kỷ luật giống như một sức mạnh vô hình nằm trong người con. Khi đồng hồ reo và con tự dậy mà không cần ai gọi — đó là kỷ luật. Khi không ai nhìn mà con vẫn tự đánh răng — cũng là kỷ luật. Người có kỷ luật không cần ai nhắc, vì con tự biết điều gì đúng cho mình.',
    example: 'Trong app này, mỗi lần con tick một việc mà không cần bố mẹ nhắc, con đang luyện kỷ luật đó đấy! Camera không phải để trông con — nó chỉ ghi lại lúc con tự làm được, để bố mẹ khen con đúng lúc.',
    try_it: 'Hôm nay con chọn 1 việc bất kỳ và tự làm nó TRƯỚC khi ai kịp nhắc. Xong con tự tick và xem Sao Nhí nói gì nhé!',
  },
  {
    slug: 'danh-sach-viec', title: 'Danh sách việc (Todo)', icon: '📝', category: 'Tư duy', sort: 2,
    summary: 'Ghi ra giấy những việc cần làm — đầu óc nhẹ hơn, không quên nữa.',
    intro: 'Não mình giống một cái túi. Nếu nhét quá nhiều việc vào mà không ghi ra đâu hết, túi sẽ đầy và… rơi rớt thiếu thứ này thiếu thứ kia (quên!). Danh sách việc — người lớn hay gọi là "todo" — là mình lấy tờ giấy viết hết các việc ra. Viết xong, đầu óc nhẹ tênh vì không phải nhớ nữa, chỉ cần LÀM.',
    example: 'Màn Hôm Nay của con chính là một danh sách việc! 13 việc được viết sẵn, con làm xong cái nào tick cái đó. Xem timeline con còn biết việc gì sắp tới — không bao giờ bị "ơ quên mất" nữa.',
    try_it: 'Ngoài các việc trong app, con thử tự viết/dán 1 việc con muốn làm mai (vd: cho gà ăn). Sáng mai làm xong, báo bố mẹ thêm vào checklist nhé!',
  },
  {
    slug: 'lap-lich', title: 'Tư duy lập lịch', icon: '📅', category: 'Tư duy', sort: 3,
    summary: 'Nhìn thấy thời gian — biết hôm nay, tuần này, tháng này có gì.',
    intro: 'Thời gian là thứ mình không nhìn thấy, không cầm được. Nhưng mình có thể VẼ nó ra! Lịch chính là bức tranh của thời gian. Người biết dùng lịch là người "nhìn thấy" được ngày mai, tuần sau — và chuẩn bị trước được.',
    example: 'Con mở tab Lịch: thấy cả tháng này, thứ mấy có gì, hôm nay có viền vàng. Tối trước ngủ, nhìn xem mai học môn gì (nhớ xem T4 có Mĩ thuật, T5 có Tiếng Anh nhé) — thế là sáng mai con không bị bất ngờ.',
    try_it: 'Tối nay trước khi ngủ, con mở Lịch và kể cho bố/mẹ nghe: mai là thứ mấy, học môn gì đầu tiên?',
  },
  {
    slug: 'tu-duy-quy-trinh', title: 'Tư duy quy trình', icon: '🧩', category: 'Tư duy', sort: 4,
    summary: 'Việc to = nhiều bước nhỏ xích lại. Làm từng bước, tự nhiên xong.',
    intro: 'Việc lớn trông có vẻ khó. Nhưng bí mật là: mọi việc to đều được làm từ nhiều bước NHỎ ghép lại. Như lắp lego — từng viên một, cuối cùng thành lâu đài! Chia việc to thành các bước, rồi làm từng bước — đó là tư duy quy trình.',
    example: 'Khối Tự học 19h00 của con có 4 bước: bấm đồng hồ → sắp đồ học → làm bài 30 phút → sắp cặp mai. Con chỉ cần biết "mình đang ở bước nào" — không cần lo hết cả bốn bước một lúc.',
    try_it: 'Chọn một việc con thấy khó (vd: dọn phòng). Con kể ra 3 bước nhỏ, rồi làm từng bước. Bước nào xong tick luôn trong app nếu có!',
  },
  {
    slug: 'tri-hoan', title: 'Trì hoãn là gì?', icon: '🐌', category: 'Thói quen', sort: 5,
    summary: 'Cái giọng nhỏ xíu bảo "để mai đi…" — mình biết mặt nó là thắng nó.',
    intro: 'Trong đầu ai cũng có một cái giọng nhỏ xíu hay nói: "Để lát nữa đi…", "Đ mai cũng được…". Nó tên là TRÌ HOÃN. Nó không xấu tính đâu, nó chỉ muốn mình chơi trước. Mình không cần đánh nó — chỉ cần nhận ra: "À, mình đang bị trì hoãn!" — rồi làm BƯỚC NHỎ NHẤT có thể.',
    example: 'Khi thấy chữ "ĐANG LÀM" vàng vàng trong app mà con còn muốn chơi — đó là lúc giọng trì hoãn thì thầm. Bí quyết: làm phần nhỏ nhất trước (chỉ cần đi đánh răng thôi, không cần nghĩ các việc khác).',
    try_it: 'Lần tới con thấy "để lát nữa" xuất hiện trong đầu, con hét to trong bụng: "Bắt được ông rồi!" — rồi làm ngay 1 bước nhỏ. Báo bố mẹ xem con bắt được mấy lần nhé!',
  },
  {
    slug: 'sai-cach-nhin', title: 'Sai — một cách nhìn khác', icon: '🌱', category: 'Tư duy', sort: 6,
    summary: 'Sai không phải là "hỏng" — sai là cơ hội não mình lớn thêm một chút.',
    intro: 'Khi con làm sai, não con không "hỏng" — nó đang LỚN! Các nhà khoa học gọi là "growth mindset" — tư duy lớn lên. Người tài không phải người không bao giờ sai, mà là người sai xong tự hỏi: "Ơ, mình sai ở đâu nhỉ?" — rồi lần sau làm khác đi.',
    example: 'Bị trễ giờ trong app không sao cả — con vẫn được tick, Sao Nhí vẫn khen vì con VẪN LÀM. Trễ hôm nay là dữ liệu để mai sớm hơn 5 phút. Không có màu đỏ, không bị mắng — chỉ có "thử lại nhé!"',
    try_it: 'Tối nay khi tự chấm sao, con kể 1 điều hôm nay chưa được lắm — và 1 ý tưởng làm khác đi mai. Đó chính là não con đang lớn!',
  },
  {
    slug: 'kien-tri-muc-tieu', title: 'Kiên trì chờ điều to', icon: '🌵', category: 'Tư duy', sort: 7,
    summary: 'Chờ được điều lớn vui hơn nhiều so với ăn ngay điều nhỏ.',
    intro: 'Có 2 loại vui: vui NGAY (ăn kẹo, xem tí phim) và vui LỚN (chiếc đồ chơi con mơ mãi, chuyến đi chơi cả nhà). Vui ngay dễ có nhưng bay nhanh. Vui lớn phải chờ — mà chờ được thì vui gấp mười lần! Người biết chờ gọi là có sự KIÊN TRÌ.',
    example: 'Thanh sao trong Mục Tiêu của con là bài tập kiên trì: mỗi ngày con làm tốt, thanh vàng nhích lên một chút. Nhìn nó đầy dần — và ngày nó chạm vạch, con sẽ thấy: chờ đợi đáng giá thật!',
    try_it: 'Con chọn 1 điều LỚN con muốn (vào Mục Tiêu nhé). Mỗi tối nhìn thanh nhích lên và tự nhủ: "Lại gần hơn một bước rồi!"',
  },
  {
    slug: 'tu-quan-sat', title: 'Tự quan sát bản thân', icon: '🔍', category: 'Thói quen', sort: 8,
    summary: 'Mỗi tối nhìn lại ngày của mình — người hiểu mình nhất chính là con.',
    intro: 'Người ta hay quan sát người khác, nhưng ít khi quan sát CHÍNH MÌNH. Mà mình là người quan trọng nhất để hiểu mà! Tự quan sát là cuối ngày tự hỏi: hôm nay mình làm gì giỏi? Chuyện gì khó? Mai mình muốn thế nào?',
    example: 'Nút "Kết thúc ngày" trong app chính là phút tự quan sát: con tự chấm sao cho mình và kể điều mình tự hào nhất. Không ai chấm giúp được — chỉ con biết hết ngày của con!',
    try_it: 'Tối nay khi tự chấm sao, con kể thêm cho bố mẹ nghe: "Hôm nay phần nào con thấy khó nhất?" — chỉ cần kể, không cần hoàn hảo.',
  },
];
const lCount = (db.prepare(`SELECT COUNT(*) c FROM lessons`).get() as any).c;
if (lCount === 0) {
  const ins = db.prepare(`INSERT INTO lessons (slug, title, icon, summary, category, intro, example, try_it, sort) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const l of LESSONS) ins.run(l.slug, l.title, l.icon, l.summary, l.category, l.intro, l.example, l.try_it, l.sort);
  console.log(`✓ Seed ${LESSONS.length} bài học Tư Duy`);
} else console.log('• lessons đã có dữ liệu, bỏ qua');

// ===== 6. Tài khoản gia đình (đăng nhập bắt buộc) =====
import { hashPin } from '../src/lib/auth';
const USERS: [string, string, string, string, string][] = [
  // [username, tên, avatar, role, pin]
  ['kid', 'Bé', '⭐', 'child', '1234'],
  ['bo', 'Bố', '👨', 'parent', '1310'],
  ['me', 'Mẹ', '👩', 'parent', '1310'],
];
const uCount = (db.prepare(`SELECT COUNT(*) c FROM users`).get() as any).c;
if (uCount === 0) {
  const ins = db.prepare(`INSERT INTO users (username, name, avatar, role, pin_hash, created_at) VALUES (?,?,?,?,?,?)`);
  for (const [un, nm, av, rl, pin] of USERS) ins.run(un, nm, av, rl, hashPin(pin), new Date().toISOString());
  console.log(`✓ Seed ${USERS.length} tài khoản (kid/1234 · bo/1310 · me/1310)`);
} else console.log('• users đã có, bỏ qua');

console.log('Seed xong. Mở app và dyệt PIN mặc định: 1310 (đổi qua env PARENT_PIN).');
