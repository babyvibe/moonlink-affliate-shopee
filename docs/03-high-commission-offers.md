# 03 — Săn sản phẩm hoa hồng cao (Offers)

| | |
| --- | --- |
| **Ưu tiên** | 2 (D2) |
| **Đối tượng** | Affiliate / KOL |
| **API** | `offers/product-offer.php`, `shop-offer.php`, `shop-info.php` |
| **Giá trị** | Chọn SP % HH cao trước khi tạo link chia sẻ |

## 1. Mục tiêu

- Trang **“Khám phá”**: tìm SP theo từ khóa, sort theo **hoa hồng %**, lọc giá/sales.
- Mỗi card → 1 nút **“Xem hoàn & tạo link”** (gọi lại luồng product-data hiện tại).
- Hiện rõ **2 loại hoa hồng khác nhau**:
  - **Offer** = tỷ lệ `%` (`commissionRate` 0.07 = 7%)
  - **Product data** = tiền `sellerComFinal + shopeeComFinal` (cashback tính từ đây)

## 2. API nguồn

### 2.1 Danh sách SP có hoa hồng

```http
GET https://data.addlivetag.com/offers/product-offer.php
    ?keyword=áo%20len
    &sortType=1
    &page=1
    &limit=20
```

| Param | Default | Ghi chú |
| --- | --- | --- |
| `keyword` | `""` | Rỗng = list chung |
| `sortType` | 1 | Theo docs offers (rate / price / sales) |
| `page`, `limit` | 1, 10 | `limit` max **50** |

**Response `products[]` mỗi dòng:**

```json
{
  "itemId": 1589295236,
  "name": "Áo len ...",
  "link": "https://shopee.vn/...",
  "image": "...",
  "commissionRate": 0.07,
  "price": 189000, "priceMin": 179000, "priceMax": 219000,
  "sales": 1200, "rating": 4.8,
  "shopId": 1, "shopName": "Shop ABC",
  "startTime": 1735689600, "endTime": 1738281600
}
```

### 2.2 Shop theo từ khóa (tuỳ chọn tab)

`GET /offers/shop-offer.php?keyword=...` → `shops[]` với `commissionRate`, `remainingBudget`, `rating`, `type`.

> `remainingBudget = 0` **không** nghĩa là hết HH — có thể không public budget.

### 2.3 Profile shop (khi mở chi tiết)

`GET /offers/shop-info.php?shopId=123` (≤20 shop / request)

Trả: `followers`, `itemCount`, `ratingStar`, `responseRate`, `responseTimeSec`, `createdAt`, badge `officialShop`, `preferredPlus`, `verified`, `vacation`, `found`.

**Phải check `found` trước** — shop có thể bị block / không tồn tại.

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/offers-service.js`

```js
export async function searchProductOffers({ keyword, sortType = 1, page = 1, limit = 20, sessionId }) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:product-offer',
    path: 'offers/product-offer.php',
    query: {
      keyword: String(keyword || '').slice(0, 200),
      sortType, page, limit: Math.min(50, limit),
    },
    sessionId,
    timeoutMs: 15_000,
  })
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`)
  return { products: body.products || [], dataSource: body.dataSource }
}
```

Cache in-memory / SQLite TTL **15 phút** theo `(keyword, sortType, page)` — offers cache nguồn 10–30 phút.

**Routes (public, rate-limit 30 req/phút):**

| Method | Path | Ghi chú |
| --- | --- | --- |
| `GET` | `/api/offers/products?keyword=&page=&limit=&sortType=` | List SP |
| `GET` | `/api/offers/shops?keyword=` | List shop |
| `GET` | `/api/offers/shops/:shopId` | Profile shop |

Map `commissionRate` → UI chỉ hiện **%** (vd `7%`), **không** nhân ra tiền ở bước list.

### 3.2 Frontend

**File:** `src/views/ExplorePage.vue` (route `#/explore`)

```text
[ Khám phá sản phẩm ]
Từ khóa: [ áo len        ] [ Tìm ]
Sắp xếp: [Hoa hồng cao ▾] [Giá ▾] [Bán chạy ▾]
Khoảng giá: [100k] – [500k]     Hoa hồng ≥ [5%]

┌───────────────────────────────┐
│ [img] Áo len cổ lọ            │
│ 189.000₫ · ★4.8 · Đã bán 1.2k │
│ Hoa hồng 7% · còn hạn 12 ngày │
│ [Xem hoàn & tạo link]         │
└───────────────────────────────┘
```

- **Card chính:** ảnh, tên, giá (min–max nếu khác), sales, rating, `commissionRate` **%**, thời hạn offer (`startTime`–`endTime`).
- Nút CTA → điều hướng sang flow convert với `url` sẵn (hoặc inline result).
- Tab **Shop**: card shop + badge official/preferred, followers; click → `shop-info`.

**Khi mở chi tiết SP (gọi product-data như trang chủ):**

```text
Hoa hồng offer: 7%  (tỷ lệ)
Hoa hồng ước tính: 12.530₫  (tiền — product data)
Cashback dự kiến:  8.771₫
```

Nhãn phân biệt 2 dòng — **không** trộn thành 1 số.

## 4. Trung thực & rủi ro

| Vấn đề | Xử lý |
| --- | --- |
| `commissionRate` là **% offer**, không phải tiền | Nhãn rõ như trên |
| Offer có hạn (`startTime`/`endTime`) | Badge *“Offer còn N ngày”* / *“Đã hết hạn”* |
| Sort từ API có thể khác ý user | Fallback sort client nếu cần |
| `dataSource: fallback` | Nhãn *dữ liệu dự phòng* |
| Rate limit offers | 100 req/min khi gọi nguồn, 1000 cache — vẫn nên cache app |

## 5. Acceptance

- [ ] Search < 2s từ cache
- [ ] Sort/filter hoạt động (hoặc label rõ “API sort”)
- [ ] Không trộn % và tiền vào 1 cột
- [ ] Offer hết hạn hiển thị đúng
- [ ] CTA mở được luồng cashback như dán link tay
- [ ] `found=false` shop → không crash

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + cache + routes | 1 ngày |
| UI search + grid + filters | 1.5 ngày |
| CTA integrate | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
