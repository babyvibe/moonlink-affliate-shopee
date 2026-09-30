# 01 — Biểu đồ giá + “Giá tốt nhất”

| | |
| --- | --- |
| **Ưu tiên** | 1 (D1) |
| **Đối tượng** | Người mua (trang public) |
| **API** | `price-tracking/history.php` |
| **Giá trị** | Biết giá hiện tại có đẹp không → tin tưởng cashback hơn |

## 1. Mục tiêu

Sau khi convert link, dưới khối cashback hiện:

- Line chart **giá 30 ngày** (tuỳ chọn 7/30/90)
- Badge **“Giá thấp nhất N ngày”** khi `isLowest` / **“Giá đang cao”** khi `isHighest`
- Ngày cập nhật gần nhất

**Không làm trong scope này:** đặt ngưỡng báo giá, so sánh nhiều sàn, tự mua.

## 2. API nguồn

```http
GET https://data.addlivetag.com/price-tracking/history.php
    ?item_ids=<item_id>
    &type=price
    &format=chart
    &days=30
    &base_rate=<tỷ lệ sàn của bạn, tuỳ chọn>
```

Headers: `X-API-Key: <key>`

| Param | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `item_ids` | ✅ | Nhận cả URL SP; tối đa **50** SP |
| `type` | | `price` \| `commission` \| `both` |
| `days` | | Mặc định 90, max 730 |
| `format` | | `chart` → `labels[]` + `data[]` sẵn cho chart |
| `changes_only` | | `1` = chỉ điểm có đổi (payload nhỏ) |
| `base_rate` / `cap` | nên | Chuẩn hoá chuỗi hoa hồng theo tier của bạn |
| `no_product` | | `1` = bỏ block `product` (đỡ payload) |

**Response quan trọng (`format=chart`):**

```json
{
  "status": "success",
  "items": [{
    "itemId": 1589295236,
    "status": "success",
    "product": { "name": "...", "link": "...", "image": "..." },
    "price": {
      "count": 28,
      "chart": {
        "labels": ["2026-08-27", "..."],
        "price": [122200, "..."],
        "originalPrice": [150000, "..."],
        "discountPercent": [18, "..."]
      },
      "stats": {
        "min": 109000, "max": 150000, "avg": 125000,
        "isLowest": true, "isHighest": false,
        "change": -13200, "changePercent": -10.8,
        "dayCount": 28
      },
      "allTime": {
        "currentPrice": 122200,
        "lowestPrice": 99000, "lowestPriceDate": "2026-06-12"
      }
    }
  }]
}
```

`items[].status`: `success` | `no_data` | `error`.

## 3. Cách làm

### 3.1 Backend

**File mới:** `server/services/price-history-service.js`

```js
import { callDataApi } from './data-api.js'   // xem doc 00
import { getSetting } from './settings-service.js'

export async function getPriceHistory({ itemId, days = 30, sessionId }) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:price-history',
    path: 'price-tracking/history.php',
    query: {
      item_ids: itemId,
      type: 'price',
      format: 'chart',
      days: Math.min(730, Math.max(7, Number(days) || 30)),
      base_rate: getSetting('shopee_base_rate') || undefined,
      no_product: 0,
    },
    sessionId,
    timeoutMs: 15_000,
  })

  if (!response.ok) throw new Error(body?.message || body?.reason || `HTTP ${response.status}`)

  const item = body?.items?.[0]
  if (!item || item.status === 'error') {
    return { status: 'error', message: item?.reason || 'no_data' }
  }
  return {
    status: item.status, // success | no_data
    product: item.product || null,
    price: item.price || null,
    range: body.range,
  }
}
```

**Cache local (nên):** bảng SQLite `price_history_cache`

```sql
CREATE TABLE IF NOT EXISTS price_history_cache (
  item_id TEXT NOT NULL,
  days INTEGER NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, days)
);
```

- TTL **6 giờ** — đọc cache trước, hết hạn mới gọi API (giữ quota).
- Có thể dùng chung pattern với `fetchOutbound` để log.

**Route:**

```http
GET /api/links/:id/price-history?days=30
```

- Public (theo `generated_links.id` → `item_id`) — không cần login.
- Rate-limit 20 req / phút / session.
- Trả `{ ok, price, product, cachedAt }`.

**Validate:** `item_id` phải là số; `days` clamp 7–730.

### 3.2 Frontend

**File mới:** `src/components/PriceHistoryChart.vue`

- Chart thuần **SVG** (không thêm dependency) hoặc CSS bars nếu làm nhanh.
- Spec biểu đồ (theo chuẩn dataviz của repo):
  - **1 series** (giá) — không legend, title đặt tên “Giá 30 ngày”
  - Line **2px**, marker endpoint ≥ 8px
  - Grid hairline 1px, mờ
  - **Không dual-axis**
  - Tooltip giá theo ngày khi hover
  - Text dùng text-token, **không** tô màu series vào chữ
- State:
  - `loading` → skeleton
  - `no_data` → *“Chưa đủ lịch sử giá cho sản phẩm này.”*
  - `error` → ẩn chart, không phá card cashback
  - `price = 0` trong chuỗi → bỏ điểm (API có thể trả 0 khi flash-sale lỗi) — **không vẽ 0**

**Badge (ngay dưới chart):**

| Điều kiện | UI |
| --- | --- |
| `stats.isLowest` | 🟢 *“Giá thấp nhất {dayCount} ngày”* |
| `stats.isHighest` | 🟠 *“Giá đang ở vùng cao”* |
| khác | *“Giá đã thay đổi {changePercent}% trong N ngày”* |

**Gắn vào:** `LinkResultCard.vue` — section `price-history` sau `cashback-card`, trước `product-preview` (hoặc sau — nên sau cashback vì cashback là CTA chính).

### 3.3 Luồng gọi

```text
generateLink OK → UI có link.itemId
  → GET /api/links/:id/price-history?days=30   (async, không chặn)
  → PriceHistoryChart render
```

Không đưa price history vào `generateLink` (giữ POST /api/links nhanh).

## 4. Xử lý lỗi & biên

| Trường hợp | Xử lý |
| --- | --- |
| API 429 | Retry sau 30s 1 lần; fail → “Tạm bận, thử lại sau” |
| `no_data` / `no_history_in_range` | “Chưa đủ lịch sử giá” |
| Thiếu `base_rate` | Doc cảnh báo commission nhảy tier — **chỉ chart giá**, không chart HH trong bản đầu |
| Response > 20k điểm | API tự truncate + `warning` — hiện nhãn *một phần dữ liệu* |
| Item không có trong `generated_links` | 404 |

## 5. Acceptance

- [ ] Chart render đúng khi có ≥ 2 điểm giá
- [ ] Badge `isLowest` / `isHighest` đúng theo `stats`
- [ ] Không vẽ giá = 0
- [ ] `no_data` không crash UI
- [ ] Có cache 6h (log thấy 0 call OUTBOUND khi hit)
- [ ] Mobile ≤ 375px: chart không tràn, không đè nút copy

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + cache + route | 0.5–1 ngày |
| Component chart + badge | 0.5–1 ngày |
| Test tay + edge cases | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)

