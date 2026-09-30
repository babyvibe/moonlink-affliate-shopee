<script setup>
import { ref, computed } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({
  linkId: { type: String, required: true },
})

const loading = ref(false)
const error = ref('')
const result = ref(null)

const safe = computed(() => result.value?.safe === true)

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

async function load() {
  if (result.value) {
    result.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    result.value = await api.tiktokCompare(props.linkId)
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="tiktok-compare">
    <button class="text-button" type="button" :disabled="loading" @click="load">
      {{ loading ? 'Đang so sánh…' : result ? 'Ẩn so sánh TikTok' : 'So với TikTok' }}
    </button>

    <p v-if="error" class="ph-note ph-muted">{{ error }}</p>

    <div v-if="result" class="tiktok-box">
      <p v-if="!safe" class="ph-note ph-muted">
        {{ result.note || 'Có SP tương tự trên TikTok — cần xác nhận thủ công.' }}
      </p>

      <template v-else-if="result.bestMatch">
        <div class="tiktok-title">
          <strong>Trùng khớp cao</strong>
          <span class="cell-sub">{{ result.confidence }}</span>
        </div>
        <table class="tiktok-table">
          <tbody>
            <tr>
              <td>Giá</td>
              <td>{{ formatPrice(result.sourceProduct?.price) }}</td>
              <td>{{ formatPrice(result.bestMatch.price) }}</td>
            </tr>
            <tr>
              <td>Hoa hồng</td>
              <td>{{ formatPrice(result.sourceProduct?.commission) }}</td>
              <td>{{ result.bestMatch.commissionRate != null ? `${(result.bestMatch.commissionRate * 100).toFixed(1)}%` : '—' }}</td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th></th>
              <th>Shopee</th>
              <th>TikTok</th>
            </tr>
          </thead>
        </table>
        <p v-if="result.comparison?.cheaperPlatform" class="ph-note">
          Sàn rẻ hơn: <strong>{{ result.comparison.cheaperPlatform === 'tiktok' ? 'TikTok' : 'Shopee' }}</strong>
        </p>
        <a
          v-if="result.bestMatch.productLink"
          class="open-button"
          :href="result.bestMatch.productLink"
          target="_blank"
          rel="noopener noreferrer"
        >Mở trên TikTok ↗</a>
        <p v-if="result.warning" class="cell-sub">{{ result.warning }}</p>
      </template>
    </div>
  </div>
</template>
