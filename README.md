# Kids Habit ⭐

> Mỗi ngày một ngôi sao — con tự làm, con tự lớn.

**Một sản phẩm của [Linh An Solutions](https://linhan.solutions)** — open source cho mọi gia đình.

Webapp daily checklist cho trẻ 5–8 tuổi, tự xây cho gia đình mình và mở ra cho mọi người. Gamification **ground bằng khoa học** — không phải điểm thưởng vô tri.

Được xây dựng thật, chạy thật, mỗi ngày — cho một cô con gái 6 tuổi đang học lớp 1.

## Tại sao tồn tại?

Phần lớn app thói quen cho trẻ làm ngược lại với nghiên cứu tâm lý học:

| App thường làm | Kids Habit làm | Cơ sở |
|---|---|---|
| Khen "Con giỏi quá!" | **Mô tả hành vi**, không đánh giá | Kohn, Dweck, Faber & Mazlish, Siegel |
| Thưởng việc con đã thích (đọc sách) | Việc nhóm A **0 sao** — không đụng vào động lực nội tại | Lepper 1973 (over-justification) |
| Streak đứt là mất hết | **Streak mềm** — miss 1 ngày không reset | Lally 2010 (hình thành thói quen ~66 ngày) |
| Trễ giờ là bị trừ/mắng | Trễ vẫn được tick, lời nhắn connect-then-redirect | Tự chủ > áp đặt |
| Thưởng mãi mãi | **Tốt nghiệp**: ≥80% đúng giờ 4 tuần → việc rời hệ sao (fading) | Self-determination theory |

## Tính năng

- ✅ **Checklist hằng ngày** — khung giờ cứng (ăn, học, ngủ), con tự tick, ảnh check-in tùy chọn
- ⭐ **Sao & Cửa hàng** — tích sao đổi quà thực (đi công viên, thời gian chơi cùng bố mẹ), point ledger append-only
- 🐱 **Thú cưng ảo "Sao Nhí"** — lớn lên theo sự chăm chỉ của con, nói lời mô tả (không đánh giá)
- 📚 **Thư viện EPUB** — chữ to cho tuổi mới biết đọc, thưởng sao có trần
- 🎹 **Đàn piano Synthesia** — nốt rơi, touch, luyện tập có điểm kết thúc
- 🎨 **Xưởng vẽ & Tranh tô màu AI** — mỗi lần check-in tặng 1 tờ giấy vẽ (nguyên lý Premack); sinh mẫu tranh tô từ ảnh chụp qua Gemini
- 📹 **Xem camera nhà** — HLS live 2 lens, chỉ trong LAN, có kiểm tra quyền
- 🍅 **Pomodoro trẻ em** — làm việc có ý nghĩa 20/30/40' → quà video 5/10' tự tắt
- 📝 **Nhật ký giọng nói** — con kể chuyện bằng giọng mình, nghe lại về sau
- 🔥 **Streak & huy hiệu** — mốc 3/7/30 ngày
- 👨‍👩‍👧 **Đa gia đình (multi-family)** — nhiều con, mỗi con một scope dữ liệu riêng
- 🌙 **Paper mode khung 21h** — iPad không vào phòng ngủ (Carter 2016)

## Chạy local

```bash
npm install
npm run seed     # 13 việc checklist mẫu + 20 quà Kho Bí Mật
npm test         # unit tests (scoring + feedback guardrails)
npm run dev      # http://localhost:3210
```

Tài khoản demo sau khi seed: `kid/1234` (con) · `bo/1310` · `me/1310` (bố mẹ). **Đổi mật khẩu khi dùng thật.**

## Vai trò & bảo mật

- **Child** (iPad của con): vào thẳng `/` — không mật khẩu (cookie `kh_role=child`)
- **Parent**: `/parent` → PIN (env `PARENT_PIN`, mặc định `1310` — **đổi khi deploy**)
- Ảnh trẻ em lưu filesystem `data/photos/` — **không cloud công khai**; serve qua `/api/photo` có session
- Camera chỉ phát trong LAN, mọi route `/api/cam/*` kiểm tra role

## Guardrails giáo dục cài cứng trong code (đừng bỏ khi đóng góp)

1. Nhóm việc **A** (đã thích — đọc sách) = **0 sao** — chống over-justification (Lepper 1973)
2. Sao Nhí **mô tả, không đánh giá** — danh sách từ cấm trong `src/lib/feedback.ts` (test sẽ fail nếu vi phạm)
3. **Streak mềm** — miss 1 ngày không reset (Lally 2010)
4. **Trễ giờ không phạt** — vẫn +1 sao nhóm B, lời nhắn connect-then-redirect
5. **Tốt nghiệp** (fading) — ≥80% đúng giờ 4 tuần → việc rời hệ sao
6. Point ledger **append-only** — không có route update/delete
7. Paper mode khung 21h — thiết bị không vào phòng ngủ (Carter 2016)

## Cấu hình (tùy chọn)

Sao chép `.env.example` → `.env` và điền nếu dùng camera / home automation / sinh ảnh AI. Không có env này app vẫn chạy đầy đủ các tính năng chính.

## Deploy (Mac nhà — chạy 24/7)

```bash
KH_DEPLOY_HOST=your-mac-mini.local bash scripts/deploy.sh
```

- Build Next.js standalone → rsync → restart LaunchAgent (KeepAlive, RunAtLoad)
- Data production ở `data/` trên máy chủ — script deploy **không ghi đè**
- Truy cập từ xa: khuyến nghị Cloudflare Tunnel + Access (bảo vệ bằng mật khẩu)

## Cấu trúc

- `src/lib/` — db (SQLite `node:sqlite`, không dependency ngoài), scoring, feedback engine, service, camera, home automation
- `src/app/` — Next.js 15 App Router: app của con (`/`, reading, piano, draw, pomodoro, journal, ideas…) + bố mẹ (`/review`, `/admin`, `/report`)
- `scripts/` — seed, test runner, deploy, watchdog
- `books/catalog.json` — danh mục sách mẫu (epub tự chuẩn bị, không kèm trong repo)

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). PR vui lòng kèm test. Các thay đổi đụng guardrails giáo dục (danh sách trên) cần dẫn nguồn nghiên cứu.

## Giấy phép

Kids Habit là một sản phẩm của [Linh An Solutions](https://linhan.solutions).

[MIT](LICENSE) — dùng tự do cho gia đình bạn. Nếu sản phẩm của bạn derive từ Kids Habit, giữ tinh thần "trẻ em trước tiên": không quảng cáo, không data ra cloud công khai, không dark pattern giữ chân trẻ.

---

*"Mỗi ngày một ngôi sao — con tự làm, con tự lớn."*
