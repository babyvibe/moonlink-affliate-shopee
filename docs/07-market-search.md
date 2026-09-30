# 07 — Khám phá ngách (Market Search)

| | |
| --- | --- |
| **Ưu tiên** | 3 (D3) |
| **Đối tượng** | Affiliate / người chọn ngách content |
| **API** | `search/market.php` |
| **Giá trị** | Chọn từ khóa có thị trường + ít cạnh tranh |

## 1. Mục tiêu

- Ô tìm từ khóa → **tổng quan thị trường** (từ data crawl) + top SP / top shop.
- So sánh 2–3 từ khóa trên 1 màn hình (so **tương đối**).
- **Bắt buộc** hiện disclaimer — data crawl, không phải thị trường thật.

**Không làm:** khẳng định “từ khóa này lãi”; trộn chỉ số luỹ kế + kỳ; dự báo doanh thu.

## 2. API nguồn

```http
GET https://data.addlivetag.com/search/market.php
    ?q=ao%20len
    &sort=revenue_30d
    &limit=50
    &commission_min=0.1
    &price_min=50000
    &price_max=300000
```

| Param | Default | Ghi chú |
| --- | --- | --- |
| `q` / `keyword` | ✅ | ≤ 200 ký tự |
| `price_min` / `price_max` | | VND |
| `cat_id` | | Danh mục top-level |
| `commission_min` | | Decimal (`0.1` = 10%) |
| `sales_min` | | |
| `include_gifts` | `0` | `1` gộp quà (nên để `0`) |
| `sort` | `revenue_all` | `revenue_all` · `revenue_30d` · `sales` · `sold_30d` · `price` · `comm_rate` · `growth` · `rating_star` |
| `limit` | 100 | max 200 |
| `offset` | 0 | |
| `no_cache` | 0 | TTL server 6h |

**Response chính:**

```json
{
  "query": { "raw": "ao len", "normalized": "ao len", "matchMode": "..." },
  "giftsExcluded": { "applied": true, "products": 3, "note": "..." },
  "market": {
    "totalProducts": 1200, "totalShops": 340,
    "totalSold": 50000,
    "totalRevenue": 9500000000,
    "avgPrice": 189000, "minPrice": 50000, "maxPrice": 900000,
    "avgCommissionRate": 0.07, "maxCommissionRate": 0.15,
    "sellThroughRate": 0.42,
    "hhi": 0.08,
    "blueOceanScore": 61
  },
  "last30Days": {
    "coverage": 0.35,
    "totalSold": 8000,
    "totalRevenue": 1500000000
  },
  "topShops": [{ "shopId": 1, "shopName": "...", "revenue": 0 }],
  "products": [{
    "itemId": 1, "productName": "...", "shopName": "...",
    "price": 189000, "sales": 1200,
    "sold7d": 80, "sold30d": 400,
    "revenueAll": 200000000, "revenue30d": 75000000,
    "growth": 1.25, "daysTracked": 45,
    "productLink": "https://shopee.vn/..."
  }],
  "scopeNote": "..."
}
```

**`blueOceanScore` 0–100** — cao = cầu nhiều + cạnh tranh loãng. Chỉ so **giữa các từ khóa**.

### Lỗi

```json
{ "status": "error", "error": "...", "reason": "missing_query" }
```

| reason | HTTP |
| --- | --- |
| `missing_query` / `query_too_long` / `empty_query` | 400 |
| `search_unavailable` | 503 |

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/market-service.js`

```js
export async function searchMarket({ q, sort = 'revenue_30d', limit = 50, filters = {}, sessionId }) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:market-search',
    path: 'search/market.php',
    query: {
      q: String(q || '').trim().slice(0, 200),
      sort,
      limit: Math.min(200, limit),
      price_min: filters.priceMin,
      price_max: filters.priceMax,
      commission_min: filters.commissionMin,
      include_gifts: 0,
    },
    sessionId,
    timeoutMs: 20_000,
  })
  if (!response.ok) {
    throw new Error(body?.reason === 'search_unavailable'
      ? 'Tìm kiếm tạm thời gián đoạn.'
      : body?.error || body?.reason || `HTTP ${response.status}`)
  }
  return body
}
```

Cache 6h theo `(q, sort, filters)`.

**Route (public, rate-limit 20/phút):**

```http
GET /api/market/search?q=ao+len&sort=revenue_30d&limit=50&commission_min=0.1
```

Trả kèm **`scopeNote` bắt buộc** trong body — client không được bỏ.

### 3.2 Frontend

**File:** `src/views/MarketPage.vue` (route `#/market`)

```text
[ Khám phá ngách ]
Từ khóa: [ áo len ] [ Phân tích ]

⚠️ Dữ liệu tham khảo từ nguồn crawl — không phải toàn bộ thị trường.

┌─ Thị trường (luỹ kế) ───────────────┐
│ Sản phẩm 1.200 · Shop 340            │
│ Doanh thu 9,5 tỷ · Giá TB 189.000₫  │
│ TB hoa hồng 7% · Tỷ lệ có sale 42%  │
│ Cạnh tranh (HHI): 0.08 (loãng)       │
│ 🌊 Blue Ocean: 61/100                │
└──────────────────────────────────────┘

┌─ 30 ngày gần nhất (phạm vi khác) ────┐
│ Coverage 35% · Đã bán 8.000          │
│ ⚠️ Không cộng với bảng trên          │
└──────────────────────────────────────┘

Top sản phẩm theo tăng trưởng         Top shop
┌──────────────┐                      ┌──────────┐
│ SP · growth↑ │                      │ Shop     │
└──────────────┘                      └──────────┘

[ So sánh từ khóa khác: [ túi xách ] ]
```

**Khi so 2–3 từ khóa:** mini-table chỉ các cột **so sánh tương đối**:

| Từ khóa | Blue Ocean | HHI | TB HH | Giá TB | Coverage |
| --- | --- | --- | --- | --- | --- |
| áo len | 61 | 0.08 | 7% | 189k | 35% |
| túi xách | 44 | 0.21 | 5% | 250k | 40% |

## 4. Trung thực — checklist bắt buộc khi ship

- [ ] Luôn hiển thị `scopeNote` (collapsed `<details>` OK).
- [ ] **Không** cộng / so trực tiếp `market.totalSold` với `last30Days.totalSold`.
- [ ] Ghi rõ HHI là **ước lượng dưới** (chỉ top shop).
- [ ] `blueOceanScore` = so **tương đối**, không phải “điểm tuyệt đối”.
- [ ] `giftsExcluded` hiện badge *“Đã loại quà tặng khỏi tổng”*.
- [ ] `daysTracked` thấp → nhãn *“data ít”* trên hàng SP.
- [ ] Không CTA “mua ngay kiếm lời” — chỉ “Xem sản phẩm” → flow cashback.

## 5. Acceptance

- [ ] Search 1 từ khóa < 2s từ cache
- [ ] So 2–3 từ khóa trên 1 màn hình
- [ ] Disclaimer đủ 4 ý ở mục 4
- [ ] `search_unavailable` → thông báo đẹp, không stack trace
- [ ] Filter giá / HH tối thiểu hoạt động

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + cache + route | 0.5–1 ngày |
| UI 1 từ khóa | 1 ngày |
| UI so sánh nhiều từ khóa | 0.5–1 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
