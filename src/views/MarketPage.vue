<script setup>
import { computed, ref } from 'vue'
import { api } from '../services/api.js'

const q = ref('áo len')
const compareInput = ref('')
const loading = ref(false)
const error = ref('')
const result = ref(null)
const compareResult = ref(null)

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatNum(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN').format(Number(value))
}

function formatPercent(value) {
  if (value == null) return '—'
  return `${(Number(value) * 100).toFixed(1)}%`
}

const market = computed(() => result.value?.market || null)
const last30 = computed(() => result.value?.last30Days || null)

async function search() {
  error.value = ''
  if (!q.value.trim()) {
    error.value = 'Nhập từ khóa cần phân tích.'
    return
  }
  loading.value = true
  try {
    result.value = await api.marketSearch({ q: q.value, sort: 'revenue_30d', limit: 20 })
    compareResult.value = null
  } catch (requestError) {
    error.value = requestError.message
    result.value = null
  } finally {
    loading.value = false
  }
}

async function compare() {
  error.value = ''
  const keywords = compareInput.value.split(',').map((value) => value.trim()).filter(Boolean)
  if (keywords.length < 2) {
    error.value = 'Nhập ít nhất 2 từ khóa, cách nhau bằng dấu phẩy.'
    return
  }
  if (keywords.length > 3) {
    error.value = 'So sánh tối đa 3 từ khóa.'
    return
  }
  loading.value = true
  try {
    compareResult.value = await api.marketCompare(keywords)
  } catch (requestError) {
    error.value = requestError.message
    compareResult.value = null
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="market-page" aria-labelledby="market-title">
    <p class="section-kicker">Ngách</p>
    <h1 id="market-title">Khám phá thị trường</h1>
    <p class="hero-copy" style="margin: 0 0 18px; text-align: left;">
      Phân tích từ khóa theo dữ liệu tham khảo — dùng so sánh tương đối giữa các từ khóa.
    </p>

    <div class="explore-filters">
      <input
        v-model="q"
        type="search"
        placeholder="Từ khóa: áo len, nước tẩy trang…"
        :disabled="loading"
        @keydown.enter="search"
      />
      <button class="copy-button" type="button" :disabled="loading" @click="search">
        {{ loading ? 'Đang phân tích…' : 'Phân tích' }}
      </button>
    </div>

    <div class="explore-filters">
      <input
        v-model="compareInput"
        type="search"
        placeholder="So sánh 2–3 từ khóa: áo len, túi xách, giày…"
        :disabled="loading"
        @keydown.enter="compare"
      />
      <button class="secondary-button" type="button" :disabled="loading" @click="compare">
        So sánh
      </button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <!-- Bảng so sánh 2–3 từ khóa -->
    <section v-if="compareResult?.rows?.length" class="admin-panel">
      <h2>So sánh từ khóa</h2>
      <p class="cell-sub">{{ compareResult.scopeNote }}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Từ khóa</th>
              <th>Blue Ocean</th>
              <th>HHI</th>
              <th>HH TB</th>
              <th>Giá TB</th>
              <th>SL SP</th>
              <th>Doanh thu</th>
              <th>30 ngày coverage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareResult.rows" :key="row.keyword">
              <td>
                <div class="cell-title">{{ row.keyword }}</div>
                <div v-if="row.message" class="cell-sub">{{ row.message }}</div>
              </td>
              <td>{{ row.blueOceanScore ?? '—' }}</td>
              <td>{{ row.hhi ?? '—' }}</td>
              <td>{{ formatPercent(row.avgCommissionRate) }}</td>
              <td>{{ formatPrice(row.avgPrice) }}</td>
              <td>{{ formatNum(row.totalProducts) }}</td>
              <td>{{ formatPrice(row.totalRevenue) }}</td>
              <td>{{ formatPercent(row.coverage30d) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <template v-if="result?.status === 'success'">
      <div class="market-disclaimer">
        ⚠️ {{ result.scopeNote }}
      </div>

      <div class="stat-grid">
        <article class="stat-card">
          <span>Sản phẩm</span>
          <strong>{{ formatNum(market?.totalProducts) }}</strong>
        </article>
        <article class="stat-card">
          <span>Shop</span>
          <strong>{{ formatNum(market?.totalShops) }}</strong>
        </article>
        <article class="stat-card">
          <span>Doanh thu (luỹ kế)</span>
          <strong>{{ formatPrice(market?.totalRevenue) }}</strong>
        </article>
        <article class="stat-card">
          <span>Blue Ocean</span>
          <strong>{{ market?.blueOceanScore ?? '—' }}/100</strong>
        </article>
      </div>

      <div class="market-two">
        <section class="admin-panel">
          <h2>Thị trường (luỹ kế)</h2>
          <ul class="market-list">
            <li>Giá TB: <strong>{{ formatPrice(market?.avgPrice) }}</strong></li>
            <li>Hoa hồng TB: <strong>{{ formatPercent(market?.avgCommissionRate) }}</strong></li>
            <li>Tỷ lệ có sale: <strong>{{ formatPercent(market?.sellThroughRate) }}</strong></li>
            <li>HHI cạnh tranh: <strong>{{ market?.hhi ?? '—' }}</strong></li>
          </ul>
          <p class="cell-sub">HHI là ước lượng dưới (chỉ top shop).</p>
        </section>
        <section class="admin-panel">
          <h2>30 ngày gần nhất</h2>
          <ul class="market-list">
            <li>Che phủ dữ liệu: <strong>{{ formatPercent(last30?.coverage) }}</strong></li>
            <li>Đã bán: <strong>{{ formatNum(last30?.totalSold) }}</strong></li>
            <li>Doanh thu: <strong>{{ formatPrice(last30?.totalRevenue) }}</strong></li>
          </ul>
          <p class="cell-sub">⚠️ Không cộng với bảng luỹ kế.</p>
        </section>
      </div>

      <section class="admin-panel">
        <h2>Sản phẩm nổi bật</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giá</th>
                <th>30 ngày</th>
                <th>Tăng trưởng</th>
                <th>Số ngày theo dõi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in result.products" :key="product.itemId">
                <td>
                  <div class="cell-title">{{ product.productName }}</div>
                  <div class="cell-sub">{{ product.shopName }}</div>
                </td>
                <td>{{ formatPrice(product.price) }}</td>
                <td>{{ formatNum(product.sold30d) }}</td>
                <td>{{ product.growth != null ? `${(product.growth * 100).toFixed(0)}%` : '—' }}</td>
                <td>
                  {{ product.daysTracked ?? '—' }}
                  <span v-if="(product.daysTracked || 0) < 8" class="cell-sub"> · data ít</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
