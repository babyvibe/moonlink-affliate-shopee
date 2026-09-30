# 04 — Cảnh báo shop giảm hoa hồng

| | |
| --- | --- |
| **Ưu tiên** | 2 (D2) |
| **Đối tượng** | Admin / KOL theo dõi shop |
| **API** | `shop-changes.php`, `shop-check.php`, `shop-info.php` |
| **Giá trị** | Phát hiện shop đang share bị cắt % HH |

## 1. Mục tiêu

- Admin tạo **watchlist shop** (shopId + ghi chú).
- Nút **Quét** / cron chạy `shop-changes.php` → danh sách shop **giảm** ≥ 0.5 điểm % trong 7/30 ngày.
- Chi tiết: `fromRate` → `toRate`, `delta`, số ngày có data, link sang shop.

**Không làm:** email/SMS/push; tự động đổi cashback share.

## 2. API nguồn

### 2.1 Thay đổi hoa hồng (DB-only — an toàn cron)

```http
GET https://data.addlivetag.com/offers/shop-changes.php
    ?days=7
    &direction=down
    &minDelta=0.5
    &shopIds=1,2,3      # max 500
    &limit=100
    &detail=1
```

| Param | Default | Ghi chú |
| --- | --- | --- |
| `days` | 7 | 1–365 |
| `direction` | `any` | `up` \| `down` \| `any` |
| `minDelta` | 0.5 | Điểm % |
| `shopIds` | | max 500; rỗng = hệ thống |
| `detail` | 0 | `1` = `series[]` theo ngày |

**Response `changes[]`:**

```json
{
  "shopId": 123, "shopName": "Shop ABC",
  "fromRate": 7, "toRate": 3, "delta": -4, "deltaPercent": -57,
  "direction": "down",
  "minRate": 3, "maxRate": 7, "points": 5,
  "from": "2026-09-18", "to": "2026-09-25",
  "series": [{ "date": "2026-09-20", "rate": 5 }]
}
```

> ⚠️ `points: 1` **không** phải trend — cần ≥ 2 ngày data.

### 2.2 HH hiện tại (khi mở chi tiết)

```http
GET /offers/shop-check.php?shopId=123&fresh=21600&live=1&history=14
```

- `pending[]` = chưa verify xong → **không** hiểu là “không HH”.
- `shops[]` có `hasCommission`, `commissionRate`, `history` optional.

### 2.3 Profile shop (gợi ý context)

`shop-info.php` — followers, official badge, `responseRate` (xem doc 03).

## 3. Cách làm

### 3.1 Data model

```sql
CREATE TABLE IF NOT EXISTS watched_shops (
  shop_id TEXT PRIMARY KEY,
  shop_name TEXT,
  note TEXT,
  last_from_rate REAL,
  last_to_rate REAL,
  last_changed_at TEXT,
  added_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_rate_snapshots (
  shop_id TEXT NOT NULL,
  rate REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id, recorded_at)
);

CREATE TABLE IF NOT EXISTS commission_alerts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  from_rate REAL, to_rate REAL, delta REAL,
  window_days INTEGER,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'new',  -- new | seen | ignored
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Backend

**File:** `server/services/shop-watch-service.js`

```js
export async function scanWatchedShops({ days = 7, sessionId }) {
  const shopIds = listWatchedShopIds()           // ≤500
  const { body } = await callDataApi({
    label: 'addlivetag:shop-changes',
    path: 'offers/shop-changes.php',
    query: {
      days, direction: 'down', minDelta: 0.5,
      shopIds: shopIds.join(','),
      detail: 1,
    },
    sessionId,
    timeoutMs: 30_000,
  })

  for (const change of body.changes || []) {
    // chỉ cảnh báo shop trong watchlist + points >= 2
    if (change.points < 2) continue
    upsertAlert(change)
  }
}
```

**Routes (admin):**

| Method | Path | Ý nghĩa |
| --- | --- | --- |
| `GET` | `/api/admin/watched-shops` | Danh sách |
| `POST` | `/api/admin/watched-shops` | Thêm `{ shopId, note }` |
| `DELETE` | `/api/admin/watched-shops/:shopId` | Xoá |
| `POST` | `/api/admin/commission-alerts/scan` | Chạy quét ngay |
| `GET` | `/api/admin/commission-alerts?status=new` | Danh sách cảnh báo |
| `PATCH` | `/api/admin/commission-alerts/:id` | `{ status: "seen" }` |

**Cron (tuỳ chọn):** `node server/jobs/scan-shops.js` — cron OS 1 lần/ngày. Job chỉ gọi `shop-changes` (DB-only).

### 3.3 Frontend (Admin)

Thêm tab **“Cảnh báo HH”** trong `AdminReportsPage.vue`:

```text
[ + Thêm shop ID: 123456  ghi chú: shop áo len  ] [Quét ngày]

Watchlist: 3 shop    Cảnh báo mới: 2
┌────────────────────────────────────────────┐
│ 🔻 Shop ABC   7% → 3%   (−4 điểm, 5 ngày) │
│    Chi tiết ▾   [Đã xem] [Bỏ qua]         │
│    09-20: 5% · 09-22: 3%                   │
└────────────────────────────────────────────┘
```

- Ưu tiên sort **mới nhất / giảm mạnh nhất**.
- Badge `points < 2` → *“Dữ liệu ít — chưa đủ kết luận”*.
- Optional sparkline `series[]` (stepped line).

## 4. Quy tắc xử lý

| Trường hợp | Xử lý |
| --- | --- |
| `points < 2` | Không alert (hoặc cảnh báo “ít data”) |
| Shop hết watchlist | Không alert |
| Quét lỗi / 429 | Giữ alert cũ; UI báo lỗi |
| `delta > 0` (tăng) | Có thể thêm tab “Tăng HH” — sau |
| Rate = 0 cô lập | Có thể là data rác — so với doc history `suspect` |

## 5. Acceptance

- [ ] Thêm/xoá watchlist OK
- [ ] Quét tạo alert đúng shop giảm ≥ 0.5 điểm
- [ ] Không alert khi `points < 2`
- [ ] Đánh dấu seen / ignored
- [ ] Cron 1 ngày chạy được không đụng quota (DB-only)
- [ ] Chi tiết không lộ API key

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| DB + service | 1 ngày |
| Admin UI | 1 ngày |
| Cron job + test | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
