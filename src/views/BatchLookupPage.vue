<script setup>
import { computed, ref } from 'vue'
import { api } from '../services/api.js'

const text = ref('')
const sub1 = ref('')
const generate = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref(null)

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const lines = computed(() => text.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))

async function run() {
  error.value = ''
  result.value = null
  if (!lines.value.length) {
    error.value = 'Hãy dán ít nhất 1 link sản phẩm.'
    return
  }
  if (lines.value.length > 100) {
    error.value = 'Tối đa 100 sản phẩm mỗi lần.'
    return
  }
  loading.value = true
  try {
    const payload = {
      lines: lines.value,
      subIds: [sub1.value || ''],
    }
    result.value = generate.value
      ? await api.batchGenerate(payload)
      : await api.batchLookup(payload)
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function copyRow(row) {
  if (!row.affiliateUrl) return
  await navigator.clipboard.writeText(row.affiliateUrl)
}

async function copyCsv() {
  if (!result.value?.rows) return
  const header = 'tên,giá,hoàn,link'
  const body = result.value.rows.map((row) =>
    `"${String(row.productName || row.input).replace(/"/g, '""')}",${row.productPrice ?? ''},${row.cashbackEstimate ?? ''},${row.affiliateUrl || ''}`
  )
  await navigator.clipboard.writeText([header, ...body].join('\n'))
}
</script>

<template>
  <section class="batch-page" aria-labelledby="batch-title">
    <p class="section-kicker">Tra nhanh</p>
    <h1 id="batch-title">Kiểm tra nhiều sản phẩm</h1>
    <p class="hero-copy" style="margin: 0 0 18px; text-align: left;">
      Dán mỗi dòng 1 link Shopee hoặc ID sản phẩm (tối đa 100).
    </p>

    <label for="batch-text">Danh sách sản phẩm</label>
    <textarea
      id="batch-text"
      v-model="text"
      class="batch-text"
      rows="8"
      :disabled="loading"
      placeholder="https://shopee.vn/product/1/2&#10;https://shopee.vn/product/3/4&#10;1589295236"
    />

    <div class="batch-actions">
      <label class="batch-check">
        <input v-model="generate" type="checkbox" :disabled="loading" />
        Tạo link ngay khi tra
      </label>
      <label class="batch-sub">
        Sub ID (tuỳ chọn)
        <input v-model="sub1" type="text" :disabled="loading" placeholder="chiến-dịch" />
      </label>
      <button class="copy-button" type="button" :disabled="loading" @click="run">
        {{ loading ? 'Đang tra…' : 'Tra cứu' }}
      </button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <template v-if="result?.ok">
      <div class="batch-summary">
        <strong>{{ formatPrice(result.summary?.totalCashback) }}</strong>
        <span>
          Tổng hoàn dự kiến · {{ result.summary?.success }}/{{ result.summary?.requested }} SP
          <template v-if="result.summary?.invalid"> · {{ result.summary.invalid }} không hợp lệ</template>
          <template v-if="result.summary?.notFound"> · {{ result.summary.notFound }} không tìm thấy</template>
        </span>
      </div>

      <div class="batch-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Giá</th>
              <th>Hoàn dự kiến</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in result.rows" :key="index" :class="`st-${row.status}`">
              <td>
                <div class="cell-title">{{ row.productName || row.input }}</div>
                <div class="cell-sub">
                  {{ row.status === 'success' ? (row.shopName || '') : (row.message || row.status) }}
                </div>
              </td>
              <td>{{ formatPrice(row.productPrice) }}</td>
              <td>
                <strong v-if="row.cashbackEstimate != null">{{ formatPrice(row.cashbackEstimate) }}</strong>
                <span v-else>—</span>
              </td>
              <td>
                <button
                  v-if="row.affiliateUrl"
                  class="icon-button"
                  type="button"
                  aria-label="Sao chép link"
                  @click="copyRow(row)"
                >
                  <svg viewBox="0 0 24 24"><path d="M9 4h6v4H9zM7 8h10v12H7zM5 12H3V6a2 2 0 0 1 2-2h2" /></svg>
                </button>
                <span v-else class="cell-sub">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="secondary-button" type="button" @click="copyCsv">Copy CSV</button>
    </template>
  </section>
</template>
