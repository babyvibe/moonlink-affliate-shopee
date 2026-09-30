<div align="center">

# ◓ MOONLINK

**Dán link Shopee · Biết ngay được hoàn bao nhiêu**

Công cụ cho người làm Shopee Affiliate — kiểm tra tiền hoàn, tạo link theo dõi, săn sản phẩm hoa hồng cao

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-22.5%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-node:sqlite-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

<br/>

[🧰 Công cụ](#-bộ-công-cụ) ·
[🛠️ Cài đặt](#️-cài-đặt) ·
[🔑 API Key](#-hướng-dẫn-lấy-api-key--affiliate-id) ·
[🍪 Cookie](#-cookie-shopee-j2team-cookies) ·
[📡 Host test](#-tạo-host-test-bằng-cloudflare-tunnel) ·
[🌐 API](#-api-nội-bộ) ·
[🔒 Bảo mật](#-bảo-mật) ·
[📄 License](#-giấy-phép)

<br/>

<img src="./assets/demo.gif" alt="MOONLINK demo — dán link Shopee, xem tiền hoàn, tạo link affiliate" width="820" />

</div>

---

## 🚀 MOONLINK là gì?

Một website nhỏ giúp bạn **mua sắm / chia sẻ link Shopee thông minh hơn**:

> 💰 **Dán link sản phẩm vào là biết ngay được hoàn bao nhiêu.**

Không cần cài app, không cần đăng ký gì — mở trình duyệt là dùng được.  
Kèm bộ công cụ cho người làm affiliate: tra hàng loạt, săn hoa hồng cao, xem shop đang live, so sánh sàn…

---

## 🧰 Bộ công cụ

### 🛍️ Cho người mua / KOL

| Công cụ | Bạn nhận được |
| --- | --- |
| **Kiểm tra tiền hoàn** *(chính)* | Dán link → biết ngay **được hoàn bao nhiêu**, có **link mua hàng riêng** |
| ↳ **Giá 30–90 ngày** | Chart giá + nhãn *“Giá thấp nhất N ngày”* — tránh mua hớ |
| ↳ **So TikTok / Lazada** | Cùng món — sàn nào rẻ hơn, hoa hồng nào cao hơn |
| **Tra nhanh** | Dán **100 link / ID một lúc** → bảng *giá · tiền hoàn · link* · xuất Excel |
| **Sản phẩm** | Tìm SP hoa hồng cao theo từ khóa, sắp theo % HH / giá / bán chạy |
| **Chiến dịch** | Chương trình KOL, brand đang chạy trên Shopee |
| **Shop** | Shop có hoa hồng · click xem **đang live không**, giờ hay live, SP của shop |
| **Quán ăn** | Thông tin quán ShopeeFood (địa chỉ, giờ mở) + **lịch sử đơn đã đặt** |
| **Ngách** | Phân tích thị trường, cạnh tranh — so sánh **2–3 từ khóa** |

### ⚙️ Cho người vận hành (Admin)

| Tab | Làm gì |
| --- | --- |
| **Link hệ thống** | Thống kê link đã tạo, biểu đồ, copy link |
| **Chuyển đổi** | Đơn hàng / sản phẩm / click — lọc theo ngày, nguồn, trạng thái |
| **Cảnh báo HH** | Theo dõi shop · quét shop **giảm hoa hồng** 7 ngày |
| **Kiểm thử** | Bấm nút tạo **host test** `trycloudflare.com` — mở điện thoại test ngay |
| **Cài đặt** | Đổi API key, Affiliate ID, cookie, % hoàn… **không cần deploy lại** |

---

### 📡 Số liệu lấy từ đâu?

Số liệu sản phẩm, giá, hoa hồng đến từ dịch vụ **[Addlivetag](https://addlivetag.com/)** — dữ liệu đã được thu thập sẵn, không phải số liệu trực tiếp từ Shopee.

> ⏳ **Dữ liệu được lưu ~24 giờ** mới làm mới. Con số có thể lệch nhẹ so với Shopee tại thời điểm bạn xem — hãy xem là **tham khảo**.

> ⚠️ **Đây không phải app “trả tiền hoàn tự động”.**
> Trang web giúp bạn **ước tính mức hoàn** và **tạo link mua hàng**. Việc trả tiền hoàn cho người mua là do bạn tự vận hành.

---

## ✨ Vì sao nên dùng

- 💵 **Biết được hoàn bao nhiêu trước khi mua** — không phải đoán già đoán non
- 📉 **Tránh mua hớ** — thấy ngay giá 30–90 ngày qua, có phải đang ở đáy không
- ⚡ **Check 100 sản phẩm cùng lúc** — không phải ngồi dán từng link
- 🎯 **Tìm hàng dễ bán** — SP hoa hồng cao, shop đang live, thị trường bớt đông đúc
- 🔍 **So sánh đa sàn** — Shopee vs TikTok vs Lazada
- 🍜 **Quán ăn & đơn food** — tra quán, xem đơn ShopeeFood đã đặt
- 🔒 **An toàn tài khoản** — chỉ mình bạn thấy dữ liệu, không cần đăng nhập Shopee
- 🛠️ **Dễ chỉnh** — đổi tỷ lệ hoàn / khóa API ngay trên web, không cần gọi thợ
- 📡 **Chia sẻ dễ** — bấm 1 nút là có link test trên điện thoại

---

## 🎯 Ai sẽ thích dùng?

| Bạn là… | MOONLINK giúp bạn… |
| --- | --- |
| 🙋‍♀️ **Người mua hàng trên Shopee** | Biết được hoàn bao nhiêu trước khi chốt đơn |
| 🏪 **KOL / người chia sẻ link** | Tra nhanh 100 SP, chọn SP hoa hồng cao để giới thiệu |
| 💼 **Chủ shop / người bán** | Xem mặt hàng nào đang ngon, shop nào đang live, thị trường nào bớt cạnh tranh |
| 👨‍💻 **Người thích tự cài đặt** | Chạy riêng trên máy/server của mình, không phụ thuộc bên thứ ba |

---

## 🛠️ Công nghệ

*(Phần dưới đây dành cho ai muốn **tự cài đặt / phát triển** — người dùng bình thường chỉ cần mở website là dùng được.)*

| Tầng | Stack |
| --- | --- |
| **Frontend** | Vue 3 · Vite 7 · CSS thuần (chart + animation) |
| **Backend** | Node.js 22.5+ · Express 5 · native `fetch` |
| **Database** | `node:sqlite` → `data/moonlink.sqlite` |
| **Auth** | `node:crypto` scrypt · cookie HttpOnly / SameSite=Strict |
| **API ngoài** | [Addlivetag](https://addlivetag.com/) — Product Data, Offers, Market, Live, TikTok, Lazada, ShopeeFood |
| **Tracking** | `an_redir` (`s.shopee.vn/an_redir`) |
| **Host test** | Cloudflare Tunnel (`cloudflared`) |
| **Tooling** | pnpm · concurrently · node --watch |

**Không dùng:** ORM · Redis · Vue Router · UI kit · chart library.

---

## ⚙️ Cài đặt

### 1️⃣ Yêu cầu

| Thành phần | Phiên bản |
| --- | --- |
| Node.js | **≥ 22.5** (bắt buộc — `node:sqlite`) |
| pnpm | ≥ 9 |
| OS | Windows / macOS / Linux |

```bash
node -v   # cần v22.5+
```

### 2️⃣ Clone & cài dependency

```bash
git clone https://github.com/babyvibe/Cashback-Shopee.git
cd Cashback-Shopee
pnpm install
```

### 3️⃣ Cấu hình `.env`

```bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
copy .env.example .env
```

Điền **tối thiểu** (chi tiết ở [mục API key](#-hướng-dẫn-lấy-api-key--affiliate-id)):

```env
ADDLIVETAG_API_KEY=xxxxxxxx
SHOPEE_AFFILIATE_ID=17330450011
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MatKhauManh#2026
```

> 💡 Sau khi chạy, mọi cài đặt (API key, % hoàn, cookie…) đều sửa được ở **Admin → Cài đặt** — lưu vào database, không cần sửa `.env` hay deploy lại.

### 4️⃣ Chạy dev

```bash
pnpm dev
```

| URL | Mục đích |
| --- | --- |
| <http://127.0.0.1:5173> | Trang người dùng |
| <http://127.0.0.1:5173/#/admin> | Quản trị |
| <http://127.0.0.1:3000/api/health> | API health |

### 5️⃣ Build production

```bash
pnpm build    # → dist/
pnpm start    # backend Express
pnpm check    # check syntax server
```

---

## 📡 Tạo host test bằng Cloudflare Tunnel

Để test trên điện thoại / gửi link cho người khác xem, **không cần tài khoản Cloudflare**:

**Cách 1 — trong Admin (khuyến nghị):**
Mở `#/admin` → tab **Kiểm thử** → bấm **“Tạo link test”** → copy link `https://xxx.trycloudflare.com`.

**Cách 2 — terminal:**

```bash
pnpm tunnel
```

```
https://<ten-ngau-nhien>.trycloudflare.com
```

| Lệnh | Trỏ tới |
| --- | --- |
| `pnpm tunnel` | Giao diện web (Vite :5173) |
| `pnpm tunnel:api` | API backend (:3000) |

> 💡 Chạy song song 2 terminal: `pnpm dev` + `pnpm tunnel`.
> `vite.config.js` đã cho phép host `*.trycloudflare.com` (kèm ngrok / loca.lt).
> **URL đổi mỗi lần chạy.** Muốn host cố định → dùng named tunnel của Cloudflare.

<details>
<summary><b>🐳 Deploy production (nginx + HTTPS)</b></summary>

```nginx
server {
  listen 443 ssl;
  server_name moonlink.example.com;

  location / {
    root /var/www/moonlink/dist;
    try_files $uri /index.html;
  }

  location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Khi deploy HTTPS nhớ đặt `COOKIE_SECURE=1` trong `.env`.

</details>

---

## 🔑 Hướng dẫn lấy API Key & Affiliate ID

Hai giá trị **bắt buộc** để app chạy dữ liệu thật:

| Biến `.env` / Cài đặt | Lấy ở đâu |
| --- | --- |
| `ADDLIVETAG_API_KEY` | [addlivetag.com](https://addlivetag.com/) |
| `SHOPEE_AFFILIATE_ID` | Dashboard Shopee Affiliate của bạn |

### 1️⃣ Tài khoản Addlivetag

1. Vào **[https://addlivetag.com/](https://addlivetag.com/)** → đăng ký / đăng nhập.
2. *(Để xem báo cáo đơn/click)* Liên kết **cookie Shopee Affiliate** tại mục conversion accounts và **bật đồng bộ**.

### 2️⃣ Lấy `ADDLIVETAG_API_KEY`

1. Trong Addlivetag → mục **API Key / Tạo Key** (hoặc trang tool conversion).
2. Bấm **Tạo Key** → copy chuỗi ~48 ký tự hex.
3. Dán vào **Admin → Cài đặt** (hoặc `.env`):

```env
ADDLIVETAG_API_KEY=chuoi_key_cua_ban
```

**Test key nhanh:**

```bash
curl -s "https://data.addlivetag.com/product-data/product-data.php?item_id=1589295236" \
  -H "X-API-Key: ADDLIVETAG_API_KEY_CUA_BAN"
```

Trả JSON có `productInfo` → OK.

> 📌 Key gửi qua header **`X-API-Key`**. Từ **01/10/2026** bắt buộc có key.

### 3️⃣ Lấy `SHOPEE_AFFILIATE_ID`

1. Vào dashboard **Shopee Affiliate** (KOL / Publisher / Network bạn đang tham gia).
2. Tìm **Affiliate ID** / **Publisher ID** (chuỗi số).
3. Hoặc tạo 1 link affiliate bất kỳ rồi soi tham số `affiliate_id=` trên URL.

```env
SHOPEE_AFFILIATE_ID=17330450011
```

### 4️⃣ *(Tùy chọn)* Rate hoa hồng riêng

```env
SHOPEE_BASE_RATE=8
SHOPEE_CAP_RAW=40000
```

---

## 🍪 Cookie Shopee (J2Team Cookies)

Một số tính năng **cần cookie tài khoản Shopee** để đọc dữ liệu **của riêng bạn**:

| Tính năng | Dùng cookie để làm gì |
| --- | --- |
| **Đơn ShopeeFood** | Xem lịch sử đơn hàng bạn đã đặt |
| **Đơn / click Shopee Affiliate** | *Không cần dán cookie ở đây* — cookie kết nối tại [addlivetag.com](https://addlivetag.com/) rồi API key đọc dữ liệu đã sync |

### Cách lấy cookie bằng J2Team Cookies

1. Cài tiện ích **[J2Team Cookies](https://chromewebstore.google.com/detail/j2team-cookies/okpidcojpimokonjdbjjehnjadooppkj)** cho Chrome/Edge.
2. Đăng nhập tài khoản **Shopee** trên trình duyệt.
3. Bấm icon **J2Team Cookies** → **Get Cookies** → **Copy**.
4. Vào **Admin → Cài đặt** → dán vào ô **Cookie Shopee Affiliate (J2Team)** → **Lưu cài đặt**.

> ⚠️ Cookie là **thông tin đăng nhập**. Chỉ lưu trên máy chủ của bạn, **không** chia sẻ cho người khác.
> Cookie hết hạn khi bạn đăng xuất / đổi mật khẩu Shopee — lấy lại bằng J2Team.

---

## 🌐 API nội bộ

Base URL: `http://127.0.0.1:3000` (Vite proxy `/api`)

### Endpoint

| Method | Path | Auth | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Trạng thái cấu hình |
| `POST` | `/api/links` | — | **Kiểm tra tiền hoàn** → affLink + cashback |
| `GET` | `/api/links/:id/price-history` | — | Lịch sử giá 7/30/90 ngày |
| `GET` | `/api/links/:id/tiktok-compare` | — | So sánh TikTok Shop |
| `GET` | `/api/links/:id/lazada-compare` | — | So sánh Lazada |
| `POST` | `/api/lazada/lookup` | — | Resolve + product Lazada |
| `GET` | `/api/links/recent` | session | Lịch sử theo phiên |
| `DELETE` | `/api/links/recent` | session | Xóa lịch sử |
| `GET` | `/api/watchlist` | session | “Đã xem” + delta giá |
| `POST` | `/api/batch/lookup` | — | Tra nhanh ≤100 SP |
| `POST` | `/api/batch/generate` | — | Tra + tạo link hàng loạt |
| `GET` | `/api/offers/products` | — | SP hoa hồng cao |
| `GET` | `/api/offers/shops` | — | Shop có hoa hồng |
| `GET` | `/api/offers/shop-products` | — | SP của 1 shop |
| `GET` | `/api/offers/campaigns` | — | Chiến dịch sàn |
| `GET` | `/api/offers/shop-check` | — | HH hiện tại của shop |
| `GET` | `/api/live/shops` | — | Shop đang live + giờ hay live |
| `GET` | `/api/market/search` | — | Phân tích ngách từ khóa |
| `GET` | `/api/market/compare` | — | So sánh 2–3 từ khóa |
| `GET` | `/api/food/stores` | — | Thông tin quán ShopeeFood |
| `GET` | `/api/food/resolve` | — | Link food → quán |
| `GET` | `/api/food/orders` | — | Đơn ShopeeFood (cần cookie) |
| `POST` | `/api/admin/login` | Origin check | Đăng nhập admin |
| `POST` | `/api/admin/logout` | cookie | Đăng xuất |
| `GET` | `/api/admin/me` | cookie | Phiên hiện tại |
| `GET` | `/api/admin/reports/stats` | cookie | Thống kê link |
| `GET` | `/api/admin/reports/links` | cookie | Link đã tạo |
| `GET` | `/api/admin/reports/conversions` | cookie | Báo cáo đơn / click |
| `GET`/`PUT` | `/api/admin/settings` | cookie | Cài đặt (API key, % hoàn…) |
| `GET`/`POST`/`DELETE` | `/api/admin/watched-shops` | cookie | Shop theo dõi |
| `GET`/`POST`/`PATCH` | `/api/admin/commission-alerts*` | cookie | Cảnh báo giảm hoa hồng |
| `GET`/`POST` | `/api/admin/tunnel*` | cookie | Cloudflare Tunnel |

### Ví dụ: kiểm tra tiền hoàn

```bash
curl -X POST http://127.0.0.1:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://shopee.vn/product/1388112438/28932551190","subIds":["web","demo"]}'
```

**Response `201`**

```json
{
  "ok": true,
  "link": {
    "productName": "Áo Thun Polo …",
    "productPrice": 179000,
    "commissionEstimate": 19690,
    "cashbackEstimate": 13783,
    "cashbackSharePercent": 70,
    "affiliateUrl": "https://s.shopee.vn/an_redir?origin_link=…&affiliate_id=…"
  }
}
```

---

## 🔐 Bảo mật

| Lớp | Cơ chế |
| --- | --- |
| 🔑 Mật khẩu admin | **scrypt** + salt · `timingSafeEqual` |
| 🍪 Phiên | Cookie **HttpOnly + SameSite=Strict** · token lưu **SHA-256** |
| 🚫 Dò mật khẩu | **5 lần sai / 15 phút** → khóa 15 phút · rate-limit IP |
| 🛡️ CSRF | Check **Origin/Referer** khi login |
| 🔒 Secret | API key / cookie chỉ ở **server**, mask khi trả về UI |
| 🧱 HTTP header | `X-Frame-Options` · `no-store` cho admin |

**Production checklist**

- [ ] HTTPS + `COOKIE_SECURE=1`
- [ ] `ADMIN_PASSWORD` mạnh
- [ ] Không commit `.env`
- [ ] Backup `data/moonlink.sqlite`
- [ ] Không chia sẻ link `trycloudflare.com` công khai nếu có dữ liệu nhạy cảm

---

## 🪵 Log debug

```text
[HTTP]    INFO  POST /api/links → 201 (412ms)
[OUTBOUND] INFO addlivetag:product-data GET https://data.addlivetag.com/… → 200 (380ms)
[DB]      INFO  INSERT generated_links rows=1 (2ms)
```

| Tag | Ý nghĩa |
| --- | --- |
| `[HTTP]` | Request → Express |
| `[DB]` | Thao tác SQLite |
| `[OUTBOUND]` | Gọi Addlivetag (đã che API key) |

Bật/tắt: `LOG_API=1` / `LOG_API=0` (mặc định ON khi dev).

---

## 🧩 Cấu trúc dự án

```text
Cashback-Shopee/
├── server/                      # Backend Express
│   ├── index.js                 # Route /api/*
│   ├── db.js                    # SQLite schema
│   └── services/                # 15 service (xem docs/)
│
├── src/                         # Frontend Vue
│   ├── App.vue                  # Landing + #/admin
│   ├── components/              # UI public
│   ├── views/                   # Tra nhanh · Khám phá (4 tab) · Ngách
│   ├── views/explore/           # Sản phẩm · Shop · Chiến dịch · Quán ăn
│   ├── admin/                   # Login · Reports · Settings · Tunnel · Alerts
│   └── services/                # api.js · shopee-url.js
│
├── docs/                        # Tài liệu chi tiết từng tính năng
│   ├── PRODUCT-DESIGN.md        # Thiết kế sản phẩm
│   └── 0*.md                    # Doc 00–10 (API, cách làm, acceptance)
│
├── data/moonlink.sqlite         # DB (gitignore)
├── assets/demo.gif
├── .env.example
└── README.md
```

---

## ⚠️ Xử lý lỗi thường gặp

| Thông báo | Cách sửa |
| --- | --- |
| `Không kết nối được máy chủ` | Chạy `pnpm dev` |
| `Chưa cấu hình API key` | Admin → Cài đặt → dán Addlivetag API Key |
| `Chưa cấu hình Affiliate ID` | Admin → Cài đặt → dán Shopee Affiliate ID |
| `Chưa có cookie Shopee` | Admin → Cài đặt → dán cookie J2Team |
| Số liệu khác dashboard Shopee | API cache ~24h — chỉ tham khảo |
| `Link ShopeeFood chưa hỗ trợ` | Chỉ nhận link SP (không phải food) |
| `Tạm khóa … giây` | Sai mật khẩu 5 lần — chờ hết khóa |
| SQLite `database is locked` | Tắt process cũ đang giữ DB |

**Reset khóa login:**

```bash
node -e "import('./server/services/auth-service.js').then(m => console.log(m.clearAllLoginLocks()))"
```

---

## 📣 Liên hệ

- 🐛 Báo lỗi / góp ý: [GitHub Issues](../../issues)
- 📄 Thiết kế sản phẩm: [PRODUCT-DESIGN.md](docs/PRODUCT-DESIGN.md)
- 📘 Docs tính năng chi tiết: [docs/](docs/README.md)

---

## 🙏 Lời cảm ơn

- [Addlivetag](https://addlivetag.com/) — tài liệu & API Shopee Affiliate
- [bcat95/shopee-aff](https://github.com/bcat95/shopee-aff) — tham chiếu Product Data API
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — host test nhanh
- Shopee Affiliate — hệ sinh thái publisher

---

## 📝 Giấy phép

Distributed under the **MIT License**. Xem [LICENSE](./LICENSE) để biết thêm chi tiết.

```
MIT License — free to use, modify, distribute
with attribution. No warranty.
```
