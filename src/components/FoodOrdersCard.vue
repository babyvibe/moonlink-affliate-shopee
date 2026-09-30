<script setup>
import { ref } from 'vue'
import { api } from '../services/api.js'

const loading = ref(false)
const error = ref('')
const needCookie = ref(false)
const orders = ref([])
const summary = ref(null)

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatTime(value) {
  if (!value) return '—'
  const date = typeof value === 'number'
    ? (value > 1e12 ? new Date(value) : new Date(value * 1000))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

async function load() {
  loading.value = true
  error.value = ''
  needCookie.value = false
  try {
    const result = await api.foodOrders()
    orders.value = result.orders || []
    summary.value = result.summary || null
  } catch (requestError) {
    if (requestError.message?.includes('cookie') || requestError.message?.includes('Cookie')) {
      needCookie.value = true
    } else {
      error.value = requestError.message
    }
    orders.value = []
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="food-orders-card">
    <div class="sl-head">
      <h4>Đơn ShopeeFood đã đặt</h4>
      <button class="secondary-button" type="button" :disabled="loading" @click="load">
        {{ loading ? 'Đang tải…' : 'Xem đơn' }}
      </button>
    </div>

    <p class="cell-sub">
      Tính năng này cần <strong>cookie Shopee</strong>. Lấy cookie bằng J2Team Cookies rồi lưu ở
      <a href="#/admin">Admin → Cài đặt</a>.
    </p>

    <div v-if="needCookie" class="admin-error">
      Chưa có cookie (hoặc cookie hết hạn). Vào
      <a href="#/admin">Admin → Cài đặt</a> → dán cookie J2Team → Lưu.
    </div>
    <p v-else-if="error" class="admin-error" role="alert">{{ error }}</p>

    <template v-else-if="orders.length">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Quán / đơn</th>
              <th>Tổng tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(order, index) in orders" :key="order.id || order.order_sn || index">
              <td>{{ formatTime(order.purchase_time || order.created_at || order.order_time) }}</td>
              <td>
                <div class="cell-title">{{ order.restaurant_name || order.shop_name || order.order_sn || '—' }}</div>
                <div class="cell-sub">{{ order.order_sn || order.id || '' }}</div>
              </td>
              <td>{{ formatPrice(order.total || order.order_value || order.actual_amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="summary" class="cell-sub">
        Tổng: {{ summary.orders ?? orders.length }} đơn · {{ formatPrice(summary.gmv) }}
      </p>
    </template>
    <p v-else-if="!loading" class="cell-sub">Bấm “Xem đơn” để tải lịch sử.</p>
  </div>
</template>
