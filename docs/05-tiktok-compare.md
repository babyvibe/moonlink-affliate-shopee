# 05 — So sánh TikTok Shop

| | |
| --- | --- |
| **Ưu tiên** | 3 (D3) |
| **Đối tượng** | Người mua + affiliate |
| **API** | `tiktok/find-by-shopee.php` |
| **Giá trị** | Cùng món — sàn nào rẻ / hoa hồng cao hơn |

## 1. Mục tiêu

- Nút **“So với TikTok”** trên card kết quả (sau khi đã có SP Shopee).
- Hiện **chỉ khi match tin cậy cao**: giá / hoa hồng / sàn nào lời hơn.
- Nhãn confidence trung thực — **không** bao giờ bịa “rẻ hơn X” khi match yếu.

## 2. API nguồn

```http
GET https://data.addlivetag.com/tiktok/find-by-shopee.php
    ?url=https://shopee.vn/product/...
    &limit=5
    &minScore=0.45
    &priceBand=0.2
```

Hoặc `item_id=` / (`name` + `price` cho debug).

| Param | Default | Ghi chú |
| --- | --- | --- |
| `url` / `item_id` / `name`+`price` | 1 trong 3 | |
| `limit` | 5 | max 20 |
| `minScore` | 0.45 | |
| `priceBand` | 0.2 | ±20% giá; `0` tắt |
| `cacheTtlHours` | 24 | |
| `clear_cache` | | `1` bypass |

**Response chính:**

```json
{
  "sourceProduct": { "platform": "shopee", "itemId": 1, "name": "...", "price": 199000, "commission": 21996 },
  "matches": [{
    "productId": "tt-1",
    "productName": "...",
    "shopName": "...",
    "price": 189000,
    "commissionRate": 0.08,
    "productLink": "https://shop.tiktok.com/...",
    "matchScore": 0.86,
    "matchConfidence": "high",
    "matchDetail": { "nameSim": 0.9, "priceSim": 0.8, "brandHit": 1, "modelHit": 1, "headHit": 1 }
  }],
  "bestMatch": { "...": "..." },
  "comparison": {
    "priceDiff": -10000,
    "cheaperPlatform": "tiktok",
    "higherCommissionPlatform": "tiktok",
    "warning": "..."
  }
}
```

### Thang confidence (bắt buộc bám theo)

| `matchConfidence` | Điều kiện | UI |
| --- | --- | --- |
| `high` | score ≥ 0.80 **hoặc** trùng model code | Hiện **đủ số** so sánh |
| `medium` | 0.60–0.79 | *“Có thể là SP tương tự”* — **không** hiện lệch giá |
| `low` | < 0.60 | Ẩn kết quả hoặc chỉ “Không chắc cùng SP” |

**Lỗi đặc biệt:** `424 creator_token_invalid` → *“Chưa kết nối tài khoản TikTok”* — **không retry**, không xoay key.

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/tiktok-compare-service.js`

```js
export async function compareTikTok({ url, itemId, sessionId }) {
  const { response, body } = await callDataApi({
    label: 'addlivetag:tiktok-compare',
    path: 'tiktok/find-by-shopee.php',
    query: { url, item_id: itemId, limit: 5 },
    sessionId,
    timeoutMs: 20_000,
  })

  if (response.status === 424) {
    const err = new Error('Tài khoản TikTok chưa kết nối với hệ thống dữ liệu.')
    err.status = 424
    throw err
  }
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`)

  const confidence = body.bestMatch?.matchConfidence || body.matches?.[0]?.matchConfidence
  return {
    // Chỉ trả số so sánh khi high — server enforce, không chỉ CSS ẩn
    safe: confidence === 'high',
    confidence,
    comparison: confidence === 'high' ? body.comparison : null,
    bestMatch: confidence === 'high' ? body.bestMatch : null,
    candidates: (body.matches || []).map(m => ({
      name: m.productName, score: m.matchScore,
      confidence: m.matchConfidence,
      // không trả price nếu không high
    })),
    warning: body.comparison?.warning || null,
  }
}
```

**Route (public):**

```http
GET /api/links/:id/tiktok-compare
```

- 24h cache theo `itemId` (SQLite `tiktok_compare_cache`).
- Rate-limit 10 req/phút.
- `424` → 400 message thân thiện.

### 3.2 Frontend

**File:** `src/components/TikTokCompareCard.vue`

```text
[ So với TikTok ]   ← nút, lazy load khi click

✅ Trùng khớp cao
┌──────────────────────────────────┐
│            Shopee    TikTok      │
│ Giá       199.000    189.000     │
│ Hoa hồng   21.996     25.120    │
│ TikTok rẻ hơn 10.000₫           │
│ Hoa hồng TikTok cao hơn          │
└──────────────────────────────────┘
```

- Nếu `safe === false`: chỉ hiện *“Có SP tương tự trên TikTok — cần xác nhận thủ công”* + `matchScore` (admin/debug).
- Kèm **link SP TikTok** (`productLink`) + `rel="noopener noreferrer"`.
- Nếu `comparison.warning` → hiện cảnh báo mờ phía dưới.

## 4. Trung thực (quan trọng)

1. Match là **suy đoán tên + giá** — không có image match.
2. Chỉ coi là cùng SP khi `high`.
3. Commission TikTok từ `commissionRateSource` (`observed_creator` > `observed_global` > `standard`) — nếu cần thì hiện nguồn.
4. Không hứa *“mua TikTok được hoàn MOONLINK”* — hệ thống chỉ theo dõi link Shopee.

## 5. Acceptance

- [ ] `high` → hiện đủ bảng so sánh
- [ ] `medium/low` → **không** hiện số lệch giá / hoa hồng
- [ ] `424` → thông báo kết nối, không retry
- [ ] Cache 24h (không gọi lại khi click lại trong ngày)
- [ ] Không lộ API key / creator_username

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + cache + route | 1 ngày |
| UI + rule confidence | 1 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
