<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({
  linkId: { type: String, required: true },
})

const loading = ref(false)
const error = ref('')
const history = ref(null)
const days = ref(30)
const chartMode = ref('price') // price | commission

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatDay(label) {
  if (!label) return ''
  const text = String(label)
  // "2026-08-27" → "27/08"
  const parts = text.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return text
}

const series = computed(() => {
  if (chartMode.value === 'commission' && history.value?.commissionSeries) {
    return {
      labels: history.value.commissionSeries.labels,
      price: history.value.commissionSeries.price,
    }
  }
  return history.value?.series || { labels: [], price: [] }
})
const hasChart = computed(() => (series.value.labels?.length || 0) >= 2)
const hasCommission = computed(() => (history.value?.commissionSeries?.labels?.length || 0) >= 2)

const stats = computed(() => history.value?.stats || null)

const badge = computed(() => {
  const s = stats.value
  if (!s) return null
  if (s.isLowest) {
    return { tone: 'good', text: `Giá thấp nhất ${s.dayCount || series.value.labels.length} ngày` }
  }
  if (s.isHighest) {
    return { tone: 'warn', text: 'Giá đang ở vùng cao' }
  }
  if (s.changePercent != null) {
    const sign = Number(s.changePercent) > 0 ? '↑' : Number(s.changePercent) < 0 ? '↓' : ''
    return {
      tone: 'neutral',
      text: `Giá ${sign} ${Math.abs(Number(s.changePercent)).toFixed(1)}% trong ${s.dayCount || series.value.labels.length} ngày`,
    }
  }
  return { tone: 'neutral', text: `Có ${s.dayCount || series.value.labels.length} ngày dữ liệu giá` }
})

/** Toạ độ SVG — 1 series, line 2px, không dual-axis */
const path = computed(() => {
  const values = series.value.price
  const n = values.length
  if (n < 2) return { line: '', area: '', points: [], w: 0, h: 0 }

  const w = 600
  const h = 160
  const padX = 8
  const padY = 16
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = values.map((value, index) => {
    const x = padX + (index / (n - 1)) * (w - padX * 2)
    const y = padY + (1 - (value - min) / span) * (h - padY * 2)
    return { x, y, value, label: series.value.labels[index] }
  })

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${h} L${points[0].x.toFixed(1)},${h} Z`

  return { line, area, points, w, h, min, max }
})

const yTicks = computed(() => {
  const { min, max } = path.value
  if (min == null) return []
  return [min, (min + max) / 2, max].map((value) => ({ value, label: formatPrice(value) }))
})

const lastPoint = computed(() => path.value.points?.[path.value.points.length - 1] || null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    history.value = await api.priceHistory(props.linkId, days.value)
  } catch (requestError) {
    error.value = requestError.message
    history.value = null
  } finally {
    loading.value = false
  }
}

function setDays(value) {
  days.value = value
  load()
}

onMounted(load)
watch(() => props.linkId, load)
</script>

<template>
  <section class="price-history" aria-label="Lịch sử giá">
    <div class="ph-head">
      <h3>{{ chartMode === 'commission' ? 'Hoa hồng' : 'Giá' }} {{ days }} ngày</h3>
      <div class="ph-actions">
        <button
          v-for="value in [7, 30, 90]"
          :key="value"
          class="ph-day-btn"
          :class="{ 'is-active': days === value }"
          type="button"
          :disabled="loading"
          @click="setDays(value)"
        >{{ value }}n</button>
        <button
          v-if="hasCommission"
          class="ph-day-btn"
          :class="{ 'is-active': chartMode === 'commission' }"
          type="button"
          :disabled="loading"
          @click="chartMode = chartMode === 'price' ? 'commission' : 'price'"
        >{{ chartMode === 'price' ? 'HH' : 'Giá' }}</button>
        <span v-if="history?.cached" class="ph-cache">đã lưu</span>
      </div>
    </div>

    <p v-if="loading" class="ph-note">Đang tải lịch sử giá…</p>
    <p v-else-if="error" class="ph-note ph-muted">{{ error }}</p>
    <p v-else-if="history?.status === 'no_data'" class="ph-note ph-muted">
      Chưa đủ lịch sử giá cho sản phẩm này.
    </p>

    <template v-else-if="hasChart">
      <div class="ph-badge" :class="`tone-${badge?.tone || 'neutral'}`">
        {{ badge?.text }}
      </div>

      <svg
        class="ph-svg"
        :viewBox="`0 0 ${path.w} ${path.h}`"
        role="img"
        :aria-label="`Biểu đồ ${chartMode === 'commission' ? 'hoa hồng' : 'giá'} ${days} ngày`"
      >
        <path class="ph-area" :d="path.area" />
        <path class="ph-line" :d="path.line" />
        <circle
          v-if="lastPoint"
          class="ph-end"
          :cx="lastPoint.x"
          :cy="lastPoint.y"
          r="4"
        >
          <title>{{ formatDay(lastPoint.label) }} — {{ formatPrice(lastPoint.value) }}</title>
        </circle>
      </svg>

      <div class="ph-axis">
        <span>{{ formatDay(series.labels[0]) }}</span>
        <span class="ph-avg">TB {{ formatPrice(stats?.avg) }}</span>
        <span>{{ formatDay(series.labels[series.labels.length - 1]) }}</span>
      </div>

      <p class="ph-note ph-muted">
        Hiện tại {{ formatPrice(stats?.last ?? lastPoint?.value) }}
        <template v-if="stats?.min != null"> · thấp nhất {{ formatPrice(stats.min) }}</template>
        <template v-if="stats?.max != null"> · cao nhất {{ formatPrice(stats.max) }}</template>
      </p>
    </template>

    <p v-else class="ph-note ph-muted">Chưa đủ dữ liệu để vẽ biểu đồ.</p>
  </section>
</template>
