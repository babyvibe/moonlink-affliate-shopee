# Tài liệu tính năng — MOONLINK

Thiết kế chi tiết từng tính năng mở rộng (nghiên cứu 25/09/2026 từ [bcat95/shopee-aff](https://github.com/bcat95/shopee-aff)).  
Mục tiêu: **đọc doc là code được** — API, cách làm, data model, UI, rủi ro, checklist.

| Doc | Tính năng | Ưu tiên | Trạng thái |
| --- | --- | --- | --- |
| [00-data-api-overview](./00-data-api-overview.md) | Tổng quan Data API unofficial, auth, quota, adapter | — | ✅ `data-api.js` |
| [01-price-history-chart](./01-price-history-chart.md) | Biểu đồ giá + “giá tốt nhất” | Ưu tiên 1 | ✅ Đã làm |
| [02-batch-product-lookup](./02-batch-product-lookup.md) | Tra hàng loạt 100 SP (KOL) | Ưu tiên 1 | ✅ Đã làm |
| [03-high-commission-offers](./03-high-commission-offers.md) | Săn SP hoa hồng cao | Ưu tiên 2 | ✅ Đã làm |
| [04-shop-commission-alerts](./04-shop-commission-alerts.md) | Cảnh báo shop giảm hoa hồng | Ưu tiên 2 | ✅ Đã làm |
| [05-tiktok-compare](./05-tiktok-compare.md) | So sánh TikTok Shop | Ưu tiên 3 | ✅ Đã làm |
| [06-price-watch-list](./06-price-watch-list.md) | “Đã xem” + diễn biến giá | Ưu tiên 2–3 | ✅ Đã làm |
| [07-market-search](./07-market-search.md) | Khám phá ngách / từ khóa | Ưu tiên 3 | ✅ Đã làm |
| [08-shop-live](./08-shop-live.md) | Shop đang live + khung giờ hay live | Ưu tiên 2 | ✅ Đã làm |
| [09-lazada-compare](./09-lazada-compare.md) | So sánh Lazada | Ưu tiên 3 | ✅ Đã làm |
| [10-shopeefood-store](./10-shopeefood-store.md) | Thông tin quán ShopeeFood | Ưu tiên 3 | ✅ Đã làm |

Liên quan: [PRODUCT-DESIGN.md](./PRODUCT-DESIGN.md) mục 11 · [README](../README.md)

## Quy tắc chung mọi doc

1. **Adapter server** — không gọi `data.addlivetag.com` từ browser. Key nằm ở Admin → Cài đặt (`settings-service.js`).
2. **Cache trước, nguồn sau** — ưu tiên `cache_only` / TTL; tôn trọng `cooldown`.
3. **UI người mua** không lộ thuật ngữ API; admin mới hiện chi tiết kỹ thuật.
4. **Trung thực dữ liệu** — thiếu thì báo *“Chưa có dữ liệu”*, không bịa số; nhãn *tham khảo*.
5. Log `[OUTBOUND]` + `request_events` như luồng product-data hiện tại.

## Thứ tự nên làm

```text
D1:  01 chart giá  →  02 batch
D2:  03 offers     →  04 cảnh báo shop  →  08 shop live
D3:  05 TikTok     →  06 Đã xem  →  07 market search  →  09 Lazada  →  10 ShopeeFood store
```
