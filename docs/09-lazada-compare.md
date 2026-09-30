# 09 — So sánh Lazada

| | |
| --- | --- |
| **Ưu tiên** | 3 (D3) |
| **Đối tượng** | Người mua + affiliate |
| **API** | `lazada/product.php`, `lazada/resolve.php` |
| **Giá trị** | Cùng món — Shopee / TikTok / Lazada sàn nào lời hơn |

## 1. Mục tiêu

- Nút **“So với Lazada”** cạnh *“So với TikTok”* trên card kết quả.
- **Resolve link Lazada** (link ngắn `s.lazada.vn` / `c.lazada.vn` / link đầy đủ) → `itemId`.
- Hiện **giá + hoa hồng** Lazada, **so sánh tương đối** với Shopee.

⚠️ **Không so trực tiếp `commissionRate` Shopee vs Lazada** — hai sàn dùng mô hình hoa hồng khác nhau. Chỉ so **số tiền** (`commission`), và ghi rõ nguồn mỗi bên.

## 2. API nguồn

### 2.1 Product Data Lazada

```http
GET https://data.addlivetag.com/lazada/product.php
    ?ids=3235542573
    &locale=vi-VN
    &cacheTtlHours=24
```

| Param | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `ids` / `item_id` / `url` | 1 trong 3 | `ids` = nhiều ID cách `,` |
| `locale` | | `vi-VN` cho tiếng Việt |
| `cacheTtlHours` | | Mặc định 24 |
| `clear_cache` | | `1` = bypass cache |

**Response (1 ID):** `productInfo` — `itemId`, `productName`, `shopName`, `price`, `stock`, `outOfStock`, `sales`/`sales7d`, `imageUrl`, `productLink`, `commission` (tiền), `commissionRate`, `cpsCommission*`, `sameStoreCommissionRate`, `crossStoreCommissionRate`, `dataSource`.

⚠️ **`sales` của Lazada = bán 7 ngày** — **không** giống Shopee (luỹ kế). Đừng so `sales` 2 sàn.

### 2.2 Resolve link Lazada

```http
GET https://data.addlivetag.com/lazada/resolve.php?url=<link Lazada>
```

Trả `{ status, itemId, skuId, originLink, resolvedBy, inputUrl }`.

**Host hợp lệ** (chặn SSRF): `lazada.vn`, `lazada.com`, `lazada.co.id`, `lazada.com.my`, `lazada.com.ph`, `lazada.sg`, `lazada.co.th`, `lzd.co`. Host khác → `400`.

**Dạng link hỗ trợ:** PDP `…/pdp-i<itemId>-s<skuId>.html`, `…/i<id>.html`, short `s.lazada.vn`, `c.lazada.vn/t/?url=…`, param `origin_link=` / `redir=`.

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/lazada-service.js`

```js
export async function resolveLazadaUrl(url) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:lazada-resolve',
    path: 'lazada/resolve.php',
    query: { url },
    timeoutMs: 15_000,
  })
  if (response.status === 400) {
    return { status: 'error', message: 'Đây không phải link Lazada hợp lệ.' }
  }
  return body
}

export async function getLazadaProduct({ itemId, url, sessionId }) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:lazada-product',
    path: 'lazada/product.php',
    query: {
      item_id: itemId || undefined,
      url: !itemId ? url : undefined,
      locale: 'vi-VN',
    },
    sessionId,
    timeoutMs: 15_000,
  })
  const info = body?.productInfo || body?.products?.[0] || null
  return { product: info, status: info ? 'success' : 'not_found' }
}
```

Cache SQLite 24h theo `itemId` (giống `tiktok_compare_cache`).

**Routes:**

| Method | Path | Mô tả |
| --- | --- | --- |
| `GET` | `/api/links/:id/lazada-compare` | So Lazada từ SP Shopee đã tạo |
| `POST` | `/api/lazada/lookup` | Resolve + product từ 1 link Lazada (tuỳ chọn) |

**So sánh:** chỉ hiện lệch giá khi **cùng `itemId` match tên sản phẩm** (dùng `productName` similarity nhẹ, hoặc user tự xác nhận). Không có confidence API sẵn như TikTok → **mặc định coi là “gợi ý”**, không khẳng định.

### 3.2 Frontend

**Component:** `src/components/LazadaCompareCard.vue`

```text
[ So với Lazada ]

⚠️ Gợi ý sản phẩm tương tự — nên kiểm tra tay
┌────────────────────────────────────┐
│            Shopee    Lazada        │
│ Giá       199.000    185.000       │
│ Hoa hồng   21.996     18.200      │
└────────────────────────────────────┘
Lazada rẻ hơn 14.000₫ · Hoa hồng Shopee cao hơn
[ Mở Lazada ↗ ]
```

- Nhãn **“Gợi ý”** — không có `matchConfidence` như TikTok.
- Hiện cả `commissionRate` 2 sàn **riêng dòng**, kèm ghi chú *“cơ chế tính khác nhau, không so trực tiếp”*.

## 4. Trung thực (bắt buộc)

1. **Không** so `sales` Shopee (luỹ kế) vs `sales7d` Lazada.
2. **Không** so `commissionRate` (%) 2 sàn như nhau.
3. Chỉ so **số tiền** (`commission`) + **giá**.
4. Nhãn *“gợi ý, cần kiểm tra tay”* vì không có scoring chính thức.

## 5. Acceptance

- [ ] Link Lazada → resolve → product OK
- [ ] Link không phải Lazada → thông báo rõ
- [ ] Không trộn `sales` / `commissionRate` 2 sàn
- [ ] Có nhãn “gợi ý”
- [ ] Cache 24h

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + cache + route | 1 ngày |
| UI card + label | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
