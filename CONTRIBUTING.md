# Đóng góp cho Kids Habit

Cảm ơn bạn quan tâm! Đây là dự án vì trẻ em — mọi thay đổi đặt lợi ích của con lên trước.

## Nguyên tắc dự án (không thương lượng)

1. **Không quảng cáo, không tracking** — không thêm analytics gửi data trẻ em ra cloud công khai
2. **Ảnh/nhật ký của trẻ ở lại filesystem gia đình** — không thêm cloud sync mặc định
3. **Không dark pattern giữ chân trẻ** — không notification kéo con vào app, không streak gây nghiện kiểu "sắp mất rồi!"

## Guardrails giáo dục

7 guardrails trong README cài cứng trong code và có test bảo vệ. Nếu PR đụng đến:

- Đổi cách tính sao / streak → dẫn nguồn nghiên cứu trong mô tả PR
- Sửa lời khen Sao Nhí → kiểm tra `npm test` pass (feedback engine chặn từ đánh giá)

## Quy trình

1. Fork → branch (`feat/ten-tinh-nang` hoặc `fix/mo-ta`)
2. `npm test` pass trước khi commit
3. PR mô tả rõ: làm gì, tại sao, ảnh hưởng guardrail nào (nếu có)

## Chạy dev

```bash
npm install
npm run seed
npm test
npm run dev  # http://localhost:3210
```

## Phong cách code

- TypeScript strict, không `any` trừ test fixtures
- File lib chứa logic thuần, unit-test được (`src/lib/*.ts`)
- Comment tiếng Việt, ngắn, giải thích **tại sao** chứ không повтор **cái gì**
