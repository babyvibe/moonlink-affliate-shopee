# 02 — Tra hàng loạt (Batch 100 SP)

| | |
| --- | --- |
| **Ưu tiên** | 1 (D1) |
| **Đối tượng** | KOL / người làm affiliate |
| **API** | `product-data/product-data-batch.php` |
| **Giá trị** | 1 lần paste → bảng cashback 20–100 SP |

## 1. Mục tiêu

- Trang **“Tra nhanh”** (public hoặc cần login nhẹ — đề xuất **không login**, rate-limit chặt).
- Paste danh sách **link SP hoặc item_id** (mỗi dòng 1 cái).
- Bảng: SP · giá · hoa hồng · **cashback dự kiến** · nút copy link từng dòng.
- Tuỳ chọn **“Tạo link hàng loạt”** (tách khỏi bước chỉ ước lượng).

**Không làm:** import Excel/CSV file (sau), tự mua, lưu hàng nghìn SP.

## 2. API nguồn

```http
POST https://data.addlivetag.com/product-data/product-data-batch.php
Content-Type: application/json
X-API-Key: <key>

{
  "items": ["https://shopee.vn/product/1/2", "1589295236"],
  "affid": "<SHOPEE_AFFILIATE_ID>",
  "sub1": "campaign-a",
  "cache_only": 0,
  "max_api": 20
}
```

Cũng nhận form-urlencoded / GET (không khuyến nghị cho list dài).

| Param | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `item_ids` / `items` / `urls` | 1 trong 3 | **Max 100** — thừa bị drop im lặng |
| `affid` | nên | Sinh `affLink` cho từng SP |
| `sub1`…`sub5` | | Cấp batch; item override riêng |
| `base_rate`, `cap` | nên | Cùng tier tài khoản bạn |
| `cache_only` (`db_only`) | | `1` = không gọi Shopee — an toàn quota |
| `max_api` | | Mặc định 20, max 50; `0` ≈ cache_only |
| `clear_cache` | | `1` = refresh |

**Không hỗ trợ link ngắn** (`s.shopee.vn`) trong batch — phải resolve trước hoặc báo user dùng link đầy đủ.

**Response:**

```json
{
  "status": "success",
  "requested": 20,
  "returned": 20,
  "summary": { "fromCache": 12, "fromApi": 6, "stale": 1, "skipped": 0, "notFound": 1, "invalid": 0 },
  "limits": { "maxItems": 100, "sourceRateLimited": false, "sourceCooldownSeconds": 0 },
  "products": [
    {
      "input": "1589295236",
      "itemId": 1589295236,
      "status": "success",
      "dataSource": "db",
      "productInfo": { "price": 122200, "commission": 21996, "sellerComFinal": 16497, "shopeeComFinal": 5499, "...": "..." },
      "affLink": "https://s.shopee.vn/an_redir?..."
    }
  ]
}
```

`status` mỗi dòng: `success` | `stale` | `skipped` | `not_found` | `error`.

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/batch-service.js`

```js
export async function lookupBatch({ urls = [], itemIds = [], subIds = [], mode = 'estimate', sessionId }) {
  const items = [...urls, ...itemIds].slice(0, 100)

  const { response, body } = await callDataApi({
    label: 'addlivetag:product-batch',
    path: 'product-data/product-data-batch.php',
    method: 'POST',
    body: {
      items,
      affid: getSetting('shopee_affiliate_id') || undefined,
      sub1: subIds[0] || undefined,
      // sub2..sub5
      base_rate: getSetting('shopee_base_rate') || undefined,
      cap: getSetting('shopee_cap_raw') || undefined,
      // Ước lượng: chỉ cache — không đốt quota Shopee
      cache_only: mode === 'estimate' ? 1 : 0,
      max_api: mode === 'estimate' ? 0 : 20,
    },
    sessionId,
    timeoutMs: 60_000,
  })
  // map body.products[] → rows đã tính cashback bằng calcCashbackFromProduct()
}
```

**Tính cashback dòng:**

```js
import { calcCashbackFromProduct } from './link-service.js'
const calc = calcCashbackFromProduct(productInfo)
// → { cashbackEstimate, commissionGross, ... }
```

Làm tròn **từng dòng** như luồng lẻ; tổng = Σ từng dòng (không làm tròn sau cùng).

**Routes:**

| Method | Path | Mode |
| --- | --- | --- |
| `POST` | `/api/batch/lookup` | `estimate` — chỉ tra + cashback, **không** tạo link / không log `generated_links` |
| `POST` | `/api/batch/generate` | `generate` — tạo link hàng loạt, log SQLite từng dòng |

**Body:**

```json
{ "urls": ["...", "..."], "subIds": ["chiến-dịch", "", "", "", ""] }
```

Validate phía server (giống `url-service.js`):

- Mỗi dòng parse / extract `item_id`; dòng sai → row `error` riêng, **không** fail cả batch.
- Link ngắn → row `error: "short_link_unsupported"` + hướng dẫn dùng link đầy đủ (hoặc resolve đơn trước — **không** resolve 100 link ngắn 1 request).
- Cap 100 dòng — quá báo `400` rõ ràng.

**Rate-limit:** 5 batch / phút / IP (estimate); 2 batch / phút (generate).

**Log:** mỗi request 1 dòng `[OUTBOUND]`; khi generate thì `INSERT generated_links` từng SP thành công (reuse `link-service` logic nếu tách được helper).

### 3.2 Frontend

**File:** `src/views/BatchLookupPage.vue` (hoặc tab trong `App.vue` route `#/batch`)

UI đề xuất (mobile-first):

```text
[Tra nhanh nhiều sản phẩm]
┌────────────────────────────┐
│ https://shopee.vn/...      │
│ 1589295236                 │  ← textarea 6–10 dòng
│ ...                        │
└────────────────────────────┘
[ ] Tạo link ngay khi tra
Sub ID (tuỳ chọn): [__________]
[ Tra cứu ]  [ Xóa ]

── Tổng hoàn dự kiến: 245.000 ₫ (12/15 SP) ──
┌──────────────────────────────────────┐
│ SP            Giá     Hoàn    Link 📋 │
│ Áo thun…      199k    13.8k   [copy]  │
│ ✕ Không tìm thấy: 1234567            │
└──────────────────────────────────────┘
[ Copy tất cả CSV ]
```

- Badge dòng: `success` / `stale` (nhãn *dữ liệu cũ*) / `not_found` / `error`.
- Nút **Copy CSV**: `tên,giá,hoàn,link`.
- Link ngắn: highlight + tooltip *“Dùng link sản phẩm đầy đủ”*.
- Nếu thiếu config key/affid → chặn ngay trên UI (reuse `checkAdmin` / `health`).

### 3.3 Luồng xử lý lỗi từng dòng

```text
dòng parse fail        → row invalid
link ngắn              → row short_link (hướng dẫn)
API not_found          → row not_found (không retry)
API stale              → row có data + badge cũ
API 429 / cooldown     → dừng batch, hiện “Thử lại sau N giây”
missing API key        → chặn trước khi gọi
```

## 4. Quota — quan trọng

| Mode | Chiến lược |
| --- | --- |
| **Ước lượng** (mặc định) | `cache_only=1`, `max_api=0` |
| **Tạo link** | `max_api=20`; user paste 100 SP mới → chấp nhận delay |
| Quét lớn (admin sau) | Chia gói 100, nghỉ giữa chừng, retry `stale`/`skipped` |

Nếu `limits.sourceRateLimited === true` → hiện *“Hệ thống đang tải dữ liệu, thử lại sau {sourceCooldownSeconds}s”*.

## 5. Acceptance

- [ ] 100 dòng / request; dòng 101 → lỗi 400 rõ
- [ ] Tổng cashback = Σ cashback từng dòng
- [ ] Link ngắn → row riêng, không sập cả bảng
- [ ] Copy CSV đủ cột
- [ ] Mode estimate không ghi `generated_links`
- [ ] Mode generate log đủ N dòng vào admin
- [ ] Rate-limit 429 khi spam

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service batch + validate | 1 ngày |
| Routes + rate-limit | 0.5 ngày |
| UI textarea + bảng + CSV | 1–1.5 ngày |
| Test 100 dòng, edge | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
