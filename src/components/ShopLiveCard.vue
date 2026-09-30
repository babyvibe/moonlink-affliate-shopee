<script setup>
import { ref } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({
  shopId: { type: String, default: '' },
  shopName: { type: String, default: '' },
})
const emit = defineEmits(['open-products'])

const loading = ref(false)
const error = ref('')
const shops = ref([])
const missing = ref([])

function formatTime(ms) {
  if (!ms) return '—'
  const date = new Date(Number(ms) > 1e12 ? Number(ms) : Number(ms) * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function formatDuration(sec) {
  if (!sec) return '—'
  const minutes = Math.round(Number(sec) / 60)
  return `${minutes} phút`
}

async function load() {
  if (!props.shopId) return
  loading.value = true
  error.value = ''
  try {
    const result = await api.shopLive({ shopIds: props.shopId, stats: 1 })
    shops.value = result.shops || []
    missing.value = result.missing || []
  } catch (requestError) {
    error.value = requestError.message
    shops.value = []
  } finally {
    loading.value = false
  }
}

async function refresh() {
  if (!props.shopId) return
  loading.value = true
  error.value = ''
  try {
    const result = await api.shopLive({ shopIds: props.shopId, stats: 1, refresh: 1 })
    shops.value = result.shops || []
    missing.value = result.missing || []
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function copyShopId() {
  await navigator.clipboard.writeText(props.shopId)
}

import { onMounted } from 'vue'
onMounted(load)
</script>

<template>
  <div class="shop-live-card">
    <div class="sl-head">
      <h4>Trạng thái live</h4>
      <button class="text-button" type="button" :disabled="loading || !shopId" @click="refresh">
        {{ loading ? 'Đang tải…' : 'Làm mới' }}
      </button>
    </div>

    <p v-if="!shopId" class="cell-sub">Chọn một shop để xem trạng thái live.</p>
    <p v-else-if="loading" class="cell-sub">Đang kiểm tra shop {{ shopName || shopId }}…</p>
    <p v-else-if="error" class="cell-sub">{{ error }}</p>

    <template v-else>
      <div v-for="shop in shops" :key="shop.shopId" class="sl-item">
        <div class="sl-title">
          <span class="sl-dot" :class="{ 'is-live': shop.isLive }" />
          <strong>{{ shopName || `Shop ${shop.shopId}` }}</strong>
          <span v-if="shop.isLive" class="sl-badge live">ĐANG LIVE</span>
          <span v-else class="sl-badge">Không live</span>
        </div>

        <p v-if="shop.title" class="cell-sub">{{ shop.title }}</p>
        <p class="cell-sub">
          👁 {{ shop.memberCnt ?? '—' }} · ♥ {{ shop.likeCnt ?? '—' }}
          <template v-if="shop.ccu != null"> · {{ shop.ccu }} người đang xem</template>
        </p>
        <p class="cell-sub">Bắt đầu: {{ formatTime(shop.startTime) }}</p>

        <div v-if="shop.stats" class="sl-stats">
          <p class="cell-sub">
            Đã live {{ shop.stats.totalSessions ?? 0 }} buổi · TB {{ formatDuration(shop.stats.avgDurationSec) }}
            <template v-if="shop.stats.recentSessions === 0 && (shop.stats.totalSessions || 0) > 0">
              · <span class="sl-muted">Ngừng phát gần đây</span>
            </template>
          </p>
          <div v-if="shop.topHours?.length" class="sl-hours">
            <span>Giờ hay live:</span>
            <span v-for="h in shop.topHours" :key="h.hour" class="sl-hour">
              {{ String(h.hour).padStart(2, '0') }}h ({{ h.count }})
            </span>
          </div>
        </div>

        <button class="secondary-button" type="button" @click="emit('open-products')">
          Xem sản phẩm của shop
        </button>
      </div>

      <p v-if="missing.length" class="cell-sub">
        Không có dữ liệu live cho shop {{ missing.join(', ') }}.
      </p>
    </template>
  </div>
</template>
