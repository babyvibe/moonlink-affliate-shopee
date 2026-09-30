# 06 — “Đã xem” + diễn biến giá

| | |
| --- | --- |
| **Ưu tiên** | 2–3 (D3 / xen D2) |
| **Đối tượng** | Người mua quay lại |
| **API** | `price-tracking/history.php` (`changes_only=1`) + snapshot local |
| **Giá trị** | Nhớ SP từng check, biết giá lên/xuống |

## 1. Mục tiêu

- Mục **“Đã xem”** (danh sách SP user từng kiểm tra — đã có `generated_links`).
- Mỗi SP: giá **lần trước vs nay**, cashback lần trước vs nay.
- Không gọi API mỗi lần mở — **SQLite trước**.

**Không làm:** push/email nhắc giá (để sau); account đa thiết bị (đang dùng session ẩn danh).

## 2. Dữ liệu & API

### 2.1 Có sẵn trong app

| Bảng | Dùng |
| --- | --- |
| `generated_links` | Lịch sử tra (session_id, item_id, product_price, commission_estimate, created_at) |
| `price_history_cache` (doc 01) | Cache history API |

### 2.2 Bổ sung snapshot nhẹ (nên)

```sql
CREATE TABLE IF NOT EXISTS price_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  price INTEGER,
  commission_estimate INTEGER,
  source TEXT NOT NULL DEFAULT 'lookup',  -- lookup | cron
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS price_snapshots_item
  ON price_snapshots (item_id, created_at DESC);
```

Ghi 1 dòng khi: `generateLink` thành công (lookup) + optional cron 1 lần/ngày cho top N item hay xem.

### 2.3 History khi user mở chi tiết

```http
GET /price-tracking/history.php
    ?item_ids=1589295236
    &type=both
    &changes_only=1
    &days=30
    &format=chart
    &base_rate=<setting>
```

`changes_only=1` — payload nhỏ (vd 2.1KB vs 18KB).

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/watch-list-service.js`

```js
export function listRecentProducts({ sessionId, limit = 20 }) {
  // DISTINCT theo item_id, lấy bản ghi mới nhất của session
}

export function getCompare(itemId, sessionId) {
  // so snapshot cũ nhất (lookup) vs mới nhất
  // → { prevPrice, prevAt, currPrice, currAt, priceDelta, prevCashback, currCashback }
}

export async function getTrend(itemId, days, sessionId) {
  // 1) đọc price_history_cache TTL 6–24h
  // 2) miss → callDataApi history changes_only=1
}
```

**Routes (theo session — không cần login):**

| Method | Path | Ý nghĩa |
| --- | --- | --- |
| `GET` | `/api/watchlist` | List “Đã xem” + compare lần trước |
| `GET` | `/api/watchlist/:itemId/trend?days=30` | Chuỗi giá để vẽ |
| `DELETE` | `/api/watchlist` | Xoá lịch sử (dùng `clearRecentLinks`) |

### 3.2 Frontend

Mở rộng `RecentLinks.vue` → **ProductHistoryList.vue**:

```text
Sản phẩm gần đây
┌────────────────────────────────────┐
│ Áo len …                           │
│ 189.000₫  (↓12.000 so lần trước)  │
│ Hoàn 13.783₫  (↑1.200)   📋 📈    │
└────────────────────────────────────┘
```

- Nhánh trái: tên + giá hiện tại (từ snapshot mới nhất).
- Delta: xanh khi **giá giảm** (tốt cho buyer), cam khi tăng — kèm số tuyệt đối.
- Icon 📈 → mở accordion chart (component doc 01 reuse).
- Group theo ngày (Hôm qua / Tuần này / Cũ hơn).

**Nút “Theo dõi giá” (optional):** đánh dấu `watched=1` trong snapshot để cron job ưu tiên.

## 4. Luồng cron (optional, D3)

```text
1 lần / ngày
  → lấy top 50 item_id từ generated_links (7 ngày gần nhất)
  → GET history changes_only (≤50 SP / request — match limit API)
  → ghi price_snapshots
```

- 1–2 request / ngày — **không** tốn quota Shopee (history là DB).
- Nếu user chỉ dùng local: **bỏ cron**, chỉ so lúc họ tự mở trend (still valid).

## 5. Xử lý biên

| Trường hợp | Xử lý |
| --- | --- |
| Item chưa có snapshot cũ | Chỉ hiện hiện tại, ẩn delta |
| History `no_data` | “Chưa có lịch sử giá” |
| Nhiều dòng cùng item_id | DISTINCT / group theo item |
| Session mới (user xoá cookie) | Lịch sử mất — chấp nhận ở bản này |
| Giá 0 | Bỏ / thay bằng `priceStats` như `generateLink` |

## 6. Acceptance

- [ ] List “Đã xem” render từ SQLite, không call API
- [ ] Delta giá / cashback đúng dấu
- [ ] Trend load khi click, có cache
- [ ] Xoá lịch sử hoạt động
- [ ] Session mới không crash

## 7. Ước lượng

| Việc | Effort |
| --- | --- |
| Snapshot + compare API | 0.5–1 ngày |
| UI list + delta | 1 ngày |
| Trend accordion (reuse chart) | 0.5 ngày |
| Cron (optional) | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
