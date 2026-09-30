# 08 — Shop đang live

| | |
| --- | --- |
| **Ưu tiên** | 2 (D2) |
| **Đối tượng** | KOL / người share link |
| **API** | `live/shop-live.php` |
| **Giá trị** | Biết shop đang phát trực tiếp → share link đúng lúc |

## 1. Mục tiêu

- Nhập **shop ID** (hoặc chọn từ Khám phá) → xem:
  - Shop **đang live không** (phiên mới nhất)
  - Tiêu đề, lượt xem, lượt thích, thời gian bắt đầu
  - **Bao nhiêu buổi đã live**, **khung giờ hay live** (histogram 0–23h)
- Nút **Tạo link SP của shop** → chuyển sang flow cashback

**Không làm:** nhận thông báo push khi shop live (sau); embed video live.

## 2. API nguồn

```http
GET https://data.addlivetag.com/live/shop-live.php
    ?shop_ids=123,456
    &stats=1
    &recent_days=30
```

| Param | Bắt buộc | Default | Ghi chú |
| --- | --- | --- | --- |
| `shop_ids` | ✅ | — | 1 hoặc nhiều ID, cách nhau `,` / space. Alias `shopIds`, `shop_id` |
| `stats` | | `0` | `1` = thêm `logs[]` + `stats` (parsed) |
| `recent_days` | | `30` | Cửa sổ “gần đây”, 1–365 |

**Response** — map theo `shop_id` (mọi giá trị là **chuỗi**):

```json
{
  "123": {
    "session_id": "…", "room_id": "…",
    "title": "Livestream sale 8/3",
    "cover_pic": "https://…",
    "member_cnt": "1200", "like_cnt": "340", "ccu": "89",
    "start_time": "1773571453000",
    "end_time": "0",
    "time_created": "1773571453",
    "num_live": "42",
    "logs": [ … ],
    "stats": {
      "total_sessions": 42,
      "recent_sessions": 5,
      "recent_active_days": 4,
      "first_live_at": 1770000000,
      "last_live_at": 1773571453,
      "avg_duration_sec": 3600,
      "total_duration_sec": 151200,
      "longest_duration_sec": 7200,
      "hour_histogram": [0,0,…,5,…],
      "hour_histogram_recent": [0,0,…,3,…]
    }
  }
}
```

**Quan trọng:**

| Lỗi thường gặp | Xử lý |
| --- | --- |
| Shop **không có trong map** | = **không có data**, không phải “chưa live” |
| `start_time` / `end_time` | **mili-giây** (13 số) |
| `time_created` / `time_update` | **giây** (10 số) — lệch đơn vị cố ý |
| `end_time: 0` | Chưa ghi nhận kết thúc (đang live hoặc thiếu data) |
| `recent_sessions: 0` nhưng `total_sessions` lớn | Shop **đã ngừng** phát |

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/shop-live-service.js`

```js
export async function getShopLive({ shopIds, stats = true, recentDays = 30, sessionId }) {
  const ids = (Array.isArray(shopIds) ? shopIds : String(shopIds || '').split(/[\s,]+/))
    .map((value) => String(value).trim())
    .filter((value) => /^\d{1,20}$/.test(value))
    .slice(0, 20)
  if (!ids.length) throw new Error('Thiếu shop ID hợp lệ.')

  const { response, body } = await callDataApi({
    label: 'addlivetag:shop-live',
    path: 'live/shop-live.php',
    query: {
      shop_ids: ids.join(','),
      stats: stats ? 1 : 0,
      recent_days: Math.min(365, Math.max(1, Number(recentDays) || 30)),
    },
    sessionId,
    timeoutMs: 15_000,
  })
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`)
  return { shops: body || {}, missing: ids.filter((id) => !body?.[id]) }
}
```

Cache memory TTL **10 phút** (live data không cần realtime tuyệt đối; user bấm *Làm mới* để gọi lại).

**Routes (public, rate-limit 30 req/phút):**

| Method | Path | Ghi chú |
| --- | --- | --- |
| `GET` | `/api/live/shops?shopIds=1,2&recentDays=30` | Trả `{ shops, missing }` |

Map sang shape client-friendly:

```js
{
  shopId, title, coverPic, memberCnt, likeCnt, ccu,
  startTime: 1773571453000,   // ms
  isLive: end_time == 0,
  numLive: 42,
  stats: { totalSessions, recentSessions, avgDurationSec, hourHistogram }
}
```

### 3.2 Frontend

**Component:** `src/components/ShopLiveCard.vue`

- Đặt trong **ExplorePage** tab Shop → nút *“Xem live”* cạnh *“Xem sản phẩm”*.
- Hoặc input **“Nhập Shop ID”** ở đầu tab Shop.

```text
┌──────────────────────────────────────┐
│ 🔴 ĐANG LIVE · TapHoVPP May          │
│ Livestream sale 8/3                  │
│ 👁 1.200 · ♥ 340 · 89 người xem     │
│ Bắt đầu: 19:30 hôm nay              │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ ⚪ Không live · Điện Máy Minh Châu    │
│ Đã live 42 buổi · TB 60 phút/buổi   │
│ Giờ hay live: 19–21h                 │
└──────────────────────────────────────┘
```

- **Đang live**: badge đỏ + `end_time === 0` → *“Đang trực tiếp”*
- **Giờ hay live**: bar chart 24h từ `hour_histogram` (top 3 khung giờ)
- **Shop ngừng phát**: `recent_sessions === 0` && `total_sessions > 0` → *“Ngừng phát gần đây”*

## 4. Xử lý biên

| Trường hợp | Xử lý |
| --- | --- |
| Shop không có trong map | *“Chưa có dữ liệu live của shop này”* |
| `end_time: 0` | Coi là **đang live** (khuyên dùng) |
| Quá 20 shop / request | Cắt + báo rõ |
| `start_time` dạng ms | Chia 1000 trước khi format |

## 5. Acceptance

- [ ] Nhập shop ID → hiện phiên live mới nhất + stats
- [ ] Badge **Đang live** đúng khi `end_time = 0`
- [ ] Histogram 24h render đúng top khung giờ
- [ ] Shop thiếu data → *“Chưa có dữ liệu”*, không crash
- [ ] Nút *Làm mới* bypass cache
- [ ] Format thời gian theo giờ VN

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + route + cache | 0.5 ngày |
| UI card + histogram | 0.5–1 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
