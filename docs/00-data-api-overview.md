# 00 — Tổng quan Data API unofficial

## Vị trí trong kiến trúc

```text
Browser (Vue)
   │  /api/*
   ▼
Express adapter (server/services/*)
   │  header X-API-Key
   ▼
https://data.addlivetag.com/*     ← API không chính thống
```

> 🔑 Key lấy tại [addlivetag.com](https://addlivetag.com/) (mục API Key / tool conversion).  
> **Bắt buộc từ 01/10/2026** (401 nếu thiếu). Trước đó keyless chỉ được 40% quota.

## Auth hiện có trong code

| Thành phần | File |
| --- | --- |
| Key + endpoint | `server/services/settings-service.js` (`addlivetag_api_key`, `product_api_base`, …) |
| Fallback `.env` | `server/services/env.js` |
| Gọi HTTP + log | `server/services/logger.js` → `fetchOutbound()` |
| Đang dùng | `affiliate-provider.js` (product-data) · `conversion-service.js` (conversions) |

**Mẫu adapter mới (dùng chung cho mọi doc sau):**

```js
// server/services/data-api.js (đề xuất tạo khi làm tính năng đầu tiên)
import { fetchOutbound } from './logger.js'
import { getSetting } from './settings-service.js'

export async function callDataApi({ label, path, query, method = 'GET', body, sessionId, timeoutMs = 20_000 }) {
  const apiKey = getSetting('addlivetag_api_key')
  if (!apiKey) throw new Error('Chưa cấu hình API key (Admin → Cài đặt).')

  const base = getSetting('data_api_base') || 'https://data.addlivetag.com'
  const url = `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  return fetchOutbound({
    label,
    url,
    method,
    headers: {
      'X-API-Key': apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    query,
    body,
    sessionId,
    timeoutMs,
  })
}
```

> Gợi ý: thêm setting `data_api_base` (mặc định `https://data.addlivetag.com`) vào `DEFINITIONS` trong `settings-service.js`.

## Bảng endpoint & chiến lược cache

| Path | Dùng cho | Cache nguồn | Ghi chú client |
| --- | --- | --- | --- |
| `product-data/product-data.php` | 1 SP | 3h | Có sẵn |
| `product-data/product-data-batch.php` | ≤100 SP | 3h | Doc 02 |
| `price-tracking/history.php` | Giá/HH lịch sử | DB | Doc 01, 06 |
| `offers/*.php` | Offer / shop | 10–30′ / 7d | Doc 03, 04 |
| `tiktok/find-by-shopee.php` | So TikTok | 24h | Doc 05 |
| `search/market.php` | Ngách từ khóa | DB, TTL 6h | Doc 07 |
| `lazada/*`, `shopeefood/*`, `live/*` | Mở rộng sau | — | Ngoài phạm vi |

## Quota & lỗi cần bắt

| Tín hiệu | Hành vi |
| --- | --- |
| HTTP `429` | Quota IP — backoff, không retry liên tục |
| `sourceRateLimited` / `sourceCooldownSeconds` (batch) | Nguồn Shopee rate → **cooldown ~120s**, chuyển `cache_only` |
| `stale` / `skipped` | Có data cũ — **van** dùng + nhãn *cũ*, retry sau |
| `not_found` | SP không tồn tại — **không retry** |
| `commission_unverified` | Hoa hồng chưa chắc — UI *tham khảo* |

## Giới hạn theo IP (từ docs, tham khảo)

| Luồng | Có key | Không key |
| --- | --- | --- |
| Gọi nguồn Shopee (product) | ~150/min | 60/min |
| Đọc cache product | 2000/min | 800/min |
| Batch / history | tính theo **sản phẩm**, không theo request | |

## Trung thực UI

- Không gọi API từ Vue — chỉ qua `/api/*` của server.
- Mọi chỉ số unofficial: nhãn **tham khảo**; thiếu dữ liệu → *“Chưa có dữ liệu”*.
- Market search: không trộn `market` (luỹ kế) + `last30Days` (chu kỳ) — xem doc 07.

## Checklist trước khi code tính năng mới

- [ ] Đọc doc tính năng tương ứng (`01`…`07`)
- [ ] Dùng `fetchOutbound` + `getSetting` (không hardcode key)
- [ ] Quyết định TTL cache local (SQLite / in-memory)
- [ ] Xử lý `429` + `stale` + `not_found`
- [ ] Ghi `[OUTBOUND]` label rõ (`addlivetag:history`, `addlivetag:offers`, …)
- [ ] UI người mua không lộ thuật ngữ API
