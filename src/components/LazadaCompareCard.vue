<script setup>
import { ref } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({
  linkId: { type: String, required: true },
})

const loading = ref(false)
const error = ref('')
const result = ref(null)
const lazadaUrl = ref('')

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
    result.value = await api.lazadaCompare(props.linkId, {
      url: lazadaUrl.value || undefined,
    })
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="tiktok-compare">
    <div class="lazada-input">
      <input
        v-model="lazadaUrl"
        type="url"
        placeholder="Dán link sản phẩm Lazada (để so sánh)"
        :disabled="loading"
      />
      <button class="text-button" type="button" :disabled="loading" @click="load">
        {{ loading ? 'Đang so…' : result ? 'Ẩn' : 'So với Lazada' }}
      </button>
    </div>

    <p v-if="error" class="ph-note ph-muted">{{ error }}</p>

    <div v-if="result" class="tiktok-box">
      <p v-if="result.status === 'need_link'" class="ph-note ph-muted">
        {{ result.message || 'Dán link Lazada để so sánh.' }}
      </p>

      <template v-else-if="result.status === 'success'">
        <div class="tiktok-title">
          <strong>Gợi ý sản phẩm tương tự</strong>
          <span class="cell-sub">nên kiểm tra tay</span>
        </div>

        <table class="tiktok-table">
          <thead>
            <tr>
              <th></th>
              <th>Shopee</th>
              <th>Lazada</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Giá</td>
              <td>{{ formatPrice(result.shopee?.price) }}</td>
              <td>{{ formatPrice(result.lazada?.price) }}</td>
            </tr>
            <tr>
              <td>Hoa hồng (số tiền)</td>
              <td>{{ formatPrice(result.shopee?.commission) }}</td>
              <td>{{ formatPrice(result.lazada?.commission) }}</td>
            </tr>
            <tr>
              <td>Tỷ lệ % HH</td>
              <td>—</td>
              <td>
                {{ result.lazada?.commissionRate != null ? `${(Number(result.lazada.commissionRate) * 100).toFixed(1)}%` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="ph-note">
          <template v-if="result.comparison?.cheaperPlatform">
            Sàn rẻ hơn:
            <strong>{{ result.comparison.cheaperPlatform === 'lazada' ? 'Lazada' : 'Shopee' }}</strong>
            ({{ formatPrice(Math.abs(result.comparison.priceDiff || 0)) }}) ·
          </template>
          <template v-if="result.comparison?.higherCommissionPlatform">
            Hoa hồng cao hơn:
            <strong>{{ result.comparison.higherCommissionPlatform === 'lazada' ? 'Lazada' : 'Shopee' }}</strong>
          </template>
        </p>

        <p class="cell-sub">{{ result.comparison?.rateWarning || result.disclaimer }}</p>

        <a
          v-if="result.lazada?.productLink"
          class="open-button"
          :href="result.lazada.productLink"
          target="_blank"
          rel="noopener noreferrer"
        >Mở Lazada ↗</a>
      </template>

      <p v-else class="ph-note ph-muted">{{ result.message || 'Không tìm thấy sản phẩm Lazada.' }}</p>
    </div>
  </div>
</template>
