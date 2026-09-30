# 10 — Thông tin quán ShopeeFood

| | |
| --- | --- |
| **Ưu tiên** | 3 (D3) |
| **Đối tượng** | Người tìm quán / KOL food |
| **API** | `shopeefood/store.php` |
| **Giá trị** | Tra nhanh quán: mở cửa không, địa chỉ, link order |

## 1. Mục tiêu

- Nhập **`restaurant_id`** (hoặc dán link `shopeefood.vn`) → xem:
  - Tên quán, địa chỉ, **đang mở cửa không**, giờ hoạt động
  - **Link đặt món** (`restaurant_url`)
  - Cờ chất lượng: `is_quality_merchant`, `is_pickup`
- Nút **“Mở đặt món”** → mở `restaurant_url`

**Không làm** (ngoài phạm vi):
- **Không** convert link ShopeeFood sang affiliate (xem [PRODUCT-DESIGN](./PRODUCT-DESIGN.md) mục 3 — food chưa có `an_redir`).

**Ngoài ra có tính năng cần cookie (đã làm):** [Đơn ShopeeFood](#đơn-shopeefood--cần-cookie).

---

## Đơn ShopeeFood — cần cookie

| | |
| --- | --- |
| **API** | `shopeefood/orders.php` |
| **Auth** | Cookie Shopee — header `X-SPF-Cookie` (J2Team export hoặc chuỗi `key=value;`) |
| **Lưu cookie** | Admin → **Cài đặt** → *Cookie Shopee Affiliate (J2Team)* |

**Cách lấy cookie (J2Team Cookies):**

1. Cài tiện ích [J2Team Cookies](https://chromewebstore.google.com/detail/j2team-cookies/okpidcojpimokonjdbjjehnjadooppkj) cho Chrome/Edge.
2. Đăng nhập Shopee trên trình duyệt.
3. Icon **J2Team Cookies** → **Get Cookies** → **Copy**.
4. Dán vào Admin → Cài đặt → ô *Cookie Shopee Affiliate* → **Lưu**.

**Route:** `GET /api/food/orders?from=&to=&page=&page_size=`

- Thiếu / sai cookie → `{ needCookie: true, message }` → UI hướng dẫn dán cookie.
- Ưu tiên cookie `shopeefood_cookie`, fallback `shopee_cookie`.

**UI:** Card *“Đơn ShopeeFood đã đặt”* trong tab **Quán ăn** (`#/explore`).

> ⚠️ Cookie là thông tin đăng nhập — chỉ lưu server, không lộ xuống client.

## 2. API nguồn

```http
GET https://data.addlivetag.com/shopeefood/store.php?restaurant_id=123,456
```

| Param | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `restaurant_id` | ✅ | 1 hoặc nhiều ID, cách `,` |

**Response:** mảng quán — `restaurant_id`, `name`, `address`, `is_open` (mở/đóng), `open_hours`, `restaurant_url`, `is_quality_merchant`, `is_pickup`.

- ID không hợp lệ → HTTP `400`.
- GET only (method khác → `405`).
- **Free** cho nghiên cứu / nội bộ — không dùng thương mại.

## 3. Cách làm

### 3.1 Backend

**File:** `server/services/food-service.js`

```js
export async function getFoodStores({ restaurantIds, sessionId } = {}) {
  const ids = (Array.isArray(restaurantIds) ? restaurantIds : String(restaurantIds || '').split(/[\s,]+/))
    .map((value) => String(value).trim())
    .filter((value) => /^\d{1,20}$/.test(value))
    .slice(0, 20)
  if (!ids.length) throw new Error('Thiếu mã quán hợp lệ.')

  const { response, body } = await callDataApi({
    label: 'addlivetag:shopeefood-store',
    path: 'shopeefood/store.php',
    query: { restaurant_id: ids.join(',') },
    sessionId,
    timeoutMs: 15_000,
  })
  if (response.status === 400) {
    return { status: 'error', message: 'Mã quán không hợp lệ.' }
  }
  return { stores: Array.isArray(body) ? body : (body ? [body] : []) }
}
```

**Extract `restaurant_id` từ link** (`url-service.js`):

```js
// https://shopeefood.vn/ho-chi-minh/com-thit-nuong-abc__12345
const match = text.match(/__(\d+)/) || text.match(/restaurant[_-]?id=(\d+)/i)
```

**Routes (public):**

| Method | Path | Ghi chú |
| --- | --- | --- |
| `GET` | `/api/food/stores?ids=1,2` | Tra quán |
| `GET` | `/api/food/resolve?url=…` | Link → `restaurant_id` → quán |

Cache 24h theo `restaurant_id`.

### 3.2 Frontend

**Component / trang:** thêm tab **“Quán ăn”** trong ExplorePage, hoặc tool riêng `#/food` (thêm card vào landing).

```text
[ Kiểm tra quán ShopeeFood ]
Link / mã quán: [ shopeefood.vn/ho-chi-minh/com-thit-nuong-abc__123  ]

┌────────────────────────────────────┐
│ 🟢 MỞ CỬA   Com Thịt Nướng ABC     │
│ 123 Nguyễn Huệ, Q.1, TP.HCM       │
│ Giờ mở: 10:00 – 22:00              │
│ ⭐ Quán chất lượng · Có mang về     │
│ [ Mở đặt món ↗ ]                   │
└────────────────────────────────────┘
```

> ⚠️ Luôn hiện ghi chú: *“Link ShopeeFood **chưa hỗ trợ tạo link hoàn tiền** — chỉ xem thông tin quán.”*

## 4. Xử lý biên

| Trường hợp | Xử lý |
| --- | --- |
| Link không trích được ID | *“Chưa nhận diện được mã quán”* |
| `400` | *“Mã quán không hợp lệ”* |
| Quán không tồn tại | *“Không tìm thấy quán”* |
| `is_open` thiếu | Hiện *“Chưa rõ trạng thái”* |

## 5. Acceptance

- [ ] Nhập link → resolve → hiện thông tin quán
- [ ] Badge mở/đóng cửa đúng
- [ ] Nút *Mở đặt món* mở `restaurant_url`
- [ ] Ghi chú **chưa hỗ trợ hoàn tiền food** luôn hiện
- [ ] Link không phải food → báo rõ

## 6. Ước lượng

| Việc | Effort |
| --- | --- |
| Service + resolve + route | 0.5 ngày |
| UI card | 0.5 ngày |

---

**Trạng thái:** ✅ Đã làm (MVP)
