<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({
  user: { type: Object, required: true },
})
const emit = defineEmits(['logout'])

/** 2 tab báo cáo */
const TABS = [
  { id: 'links', label: 'Link hệ thống' },
  { id: 'conversions', label: 'Chuyển đổi' },
]
const activeTab = ref('links')

const loading = ref(false)
const error = ref('')
const stats = ref(null)
const links = ref([])
const report = ref(null)
const copiedId = ref('')

const filters = reactive({
  type: 'orders', // orders | items | clicks
  source: 'shopee',
  from: '',
  to: '',
  status: '',
  page: 1,
  pageSize: 20,
})

function formatMoney(value) {
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

function formatTime(value) {
  if (!value) return '—'
  const date = typeof value === 'number'
    ? (value > 1e12 ? new Date(value) : new Date(value * 1000))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link.affiliateUrl)
    copiedId.value = link.id
    window.setTimeout(() => {
      if (copiedId.value === link.id) copiedId.value = ''
    }, 1500)
  } catch {
    /* ignore */
  }
}

/* ---- Chart data (single series, 1 trục) ---- */
const linkBars = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'Tổng link', value: stats.value.total || 0 },
    { label: 'Thành công', value: stats.value.success || 0 },
    { label: 'Lỗi', value: stats.value.failed || 0 },
    { label: 'Hôm nay', value: stats.value.today || 0 },
  ]
})

const reportRows = computed(() => report.value?.data || [])

/** Top 6 dòng theo hoa hồng / giá trị (orders|items) hoặc theo số click */
const topBars = computed(() => {
  const rows = reportRows.value
  if (!rows.length) return []

  if (filters.type === 'clicks') {
    // đếm click theo sub_id
    const map = new Map()
    for (const row of rows) {
      const key = row.sub_id || '(không có Sub ID)'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }

  return rows
    .map((row, index) => ({
      label: String(row.item_name || row.order_id || `#${index + 1}`).slice(0, 28),
      value: Number(row.commission ?? row.order_value ?? row.price ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
})

const summaryTiles = computed(() => {
  const s = report.value?.summary
  if (!s) return []
  return [
    { key: 'orders', label: 'Đơn hàng', value: formatNum(s.orders), raw: Number(s.orders || 0) },
    { key: 'clicks', label: 'Click', value: formatNum(s.clicks), raw: Number(s.clicks || 0) },
    { key: 'gmv', label: 'GMV', value: formatMoney(s.gmv), raw: Number(s.gmv || 0) },
    {
      key: 'commission',
      label: 'Hoa hồng ước tính',
      value: formatMoney(s.estimated_total_commission ?? s.gross_commission),
      raw: Number(s.estimated_total_commission ?? s.gross_commission ?? 0),
    },
    { key: 'cr', label: 'Tỷ lệ chuyển đổi', value: s.conversion_rate != null ? `${s.conversion_rate}%` : '—', raw: Number(s.conversion_rate || 0) },
  ]
})

function barWidth(value, max) {
  if (!max || max <= 0) return '0%'
  return `${Math.max(4, Math.round((value / max) * 100))}%`
}

const linkBarMax = computed(() => Math.max(1, ...linkBars.value.map((b) => b.value)))
const topBarMax = computed(() => Math.max(1, ...topBars.value.map((b) => b.value)))

async function loadLocal() {
  const [statsResult, linksResult] = await Promise.all([
    api.adminStats(),
    api.adminLinks({ limit: 20 }),
  ])
  stats.value = statsResult.stats
  links.value = linksResult.items || []
}

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    report.value = await api.adminConversions({
      type: filters.type,
      source: filters.source,
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.status || undefined,
      page: filters.page,
      page_size: filters.pageSize,
    })
  } catch (requestError) {
    error.value = requestError.message
    report.value = null
  } finally {
    loading.value = false
  }
}

async function reloadAll() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([loadLocal(), activeTab.value === 'conversions' ? loadReport() : Promise.resolve()])
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

function changePage(delta) {
  filters.page = Math.max(1, filters.page + delta)
}

function setTab(id) {
  activeTab.value = id
  if (id === 'conversions' && !report.value) loadReport()
  if (id === 'links') loadLocal()
}

watch(
  () => [filters.type, filters.source, filters.status, filters.from, filters.to],
  () => {
    filters.page = 1
    loadReport()
  }
)

watch(() => filters.page, () => {
  loadReport()
})

onMounted(async () => {
  await loadLocal()
  await loadReport()
})

async function logout() {
  try {
    await api.adminLogout()
  } finally {
    emit('logout')
  }
}
</script>

<template>
  <section class="admin-reports" aria-labelledby="admin-reports-title">
    <header class="admin-header">
      <div>
        <p class="section-kicker">Vùng vận hành</p>
        <h1 id="admin-reports-title">Báo cáo</h1>
        <p class="admin-lead">Xin chào, <strong>{{ user.username }}</strong></p>
      </div>
      <div class="admin-actions">
        <button class="secondary-button" type="button" :disabled="loading" @click="reloadAll">
          {{ loading ? 'Đang tải…' : 'Tải lại' }}
        </button>
        <button class="text-button" type="button" @click="logout">Đăng xuất</button>
      </div>
    </header>

    <div v-if="error" class="admin-error" role="alert">{{ error }}</div>

    <!-- 2 TAB -->
    <div class="report-tabs" role="tablist" aria-label="Loại báo cáo">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        role="tab"
        class="report-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="setTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- TAB 1: Link hệ thống -->
    <div v-show="activeTab === 'links'" role="tabpanel" class="report-panel">
      <div class="kpi-row" v-if="stats">
        <article class="stat-card">
          <span>Tổng link</span>
          <strong>{{ formatNum(stats.total) }}</strong>
        </article>
        <article class="stat-card">
          <span>Thành công</span>
          <strong>{{ formatNum(stats.success) }}</strong>
        </article>
        <article class="stat-card">
          <span>Lỗi</span>
          <strong>{{ formatNum(stats.failed) }}</strong>
        </article>
        <article class="stat-card">
          <span>Hôm nay</span>
          <strong>{{ formatNum(stats.today) }}</strong>
        </article>
      </div>

      <!-- Biểu đồ: 1 series, sequential 1 hue -->
      <section class="admin-panel chart-panel" aria-labelledby="chart-links-title">
        <h2 id="chart-links-title">Số link theo loại</h2>
        <p class="chart-sub">Một trục — số lượng link</p>
        <div class="bar-chart" role="img" aria-label="Biểu đồ số link theo loại">
          <div v-for="bar in linkBars" :key="bar.label" class="bar-row">
            <span class="bar-label">{{ bar.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: barWidth(bar.value, linkBarMax) }"
                :title="`${bar.label}: ${bar.value}`"
              />
            </div>
            <span class="bar-value">{{ formatNum(bar.value) }}</span>
          </div>
        </div>
      </section>

      <section class="admin-panel" aria-labelledby="local-links-title">
        <div class="panel-head">
          <h2 id="local-links-title">Link gần đây trên hệ thống</h2>
          <p class="cell-sub">Bấm biểu tượng để sao chép link</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Sản phẩm</th>
                <th>Giá</th>
                <th>Hoa hồng</th>
                <th>Hoàn dự kiến</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="link in links" :key="link.id">
                <td>{{ formatTime(link.createdAt) }}</td>
                <td>
                  <div class="cell-title">{{ link.productName || link.inputUrl }}</div>
                  <div class="cell-sub">{{ link.shopName || '—' }}</div>
                </td>
                <td>{{ formatMoney(link.productPrice) }}</td>
                <td>{{ formatMoney(link.commissionEstimate) }}</td>
                <td>
                  <strong v-if="link.cashbackEstimate != null">{{ formatMoney(link.cashbackEstimate) }}</strong>
                  <span v-else>—</span>
                </td>
                <td class="cell-link">{{ link.affiliateUrl }}</td>
                <td>
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="copiedId === link.id ? 'Đã sao chép' : 'Sao chép link'"
                    @click="copyLink(link)"
                  >
                    <svg v-if="copiedId !== link.id" viewBox="0 0 24 24"><path d="M9 4h6v4H9zM7 8h10v12H7zM5 12H3V6a2 2 0 0 1 2-2h2" /></svg>
                    <svg v-else viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                  </button>
                </td>
              </tr>
              <tr v-if="!links.length">
                <td colspan="7">Chưa có link nào được tạo.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- TAB 2: Chuyển đổi API -->
    <div v-show="activeTab === 'conversions'" role="tabpanel" class="report-panel">
      <!-- Bộ lọc -->
      <div class="filter-row">
        <label>
          Loại dữ liệu
          <select v-model="filters.type" :disabled="loading">
            <option value="orders">Đơn hàng</option>
            <option value="items">Sản phẩm trong đơn</option>
            <option value="clicks">Click</option>
          </select>
        </label>
        <label>
          Nguồn
          <select v-model="filters.source" :disabled="loading">
            <option value="shopee">Shopee</option>
            <option value="food">ShopeeFood</option>
          </select>
        </label>
        <label>
          Từ ngày
          <input v-model="filters.from" type="date" :disabled="loading" />
        </label>
        <label>
          Đến ngày
          <input v-model="filters.to" type="date" :disabled="loading" />
        </label>
        <label>
          Trạng thái
          <select v-model="filters.status" :disabled="loading">
            <option value="">Tất cả</option>
            <option value="0">Chờ duyệt</option>
            <option value="1">Đã duyệt</option>
            <option value="2">Từ chối</option>
          </select>
        </label>
      </div>

      <!-- KPI tiles -->
      <div class="kpi-row" v-if="summaryTiles.length">
        <article v-for="tile in summaryTiles" :key="tile.key" class="stat-card">
          <span>{{ tile.label }}</span>
          <strong>{{ tile.value }}</strong>
        </article>
      </div>

      <section class="admin-panel chart-panel" aria-labelledby="chart-top-title">
        <h2 id="chart-top-title">
          {{ filters.type === 'clicks' ? 'Click theo Sub ID' : 'Hoa hồng / giá trị nổi bật' }}
        </h2>
        <p class="chart-sub">
          {{ filters.type === 'clicks' ? 'Số click · tối đa 6 nhóm' : 'Tối đa 6 dòng cao nhất trong trang hiện tại' }}
        </p>
        <div v-if="topBars.length" class="bar-chart" role="img" aria-label="Biểu đồ top">
          <div v-for="bar in topBars" :key="bar.label" class="bar-row">
            <span class="bar-label" :title="bar.label">{{ bar.label }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: barWidth(bar.value, topBarMax) }"
                :title="`${bar.label}: ${formatNum(bar.value)}`"
              />
            </div>
            <span class="bar-value">
              {{ filters.type === 'clicks' ? formatNum(bar.value) : formatMoney(bar.value) }}
            </span>
          </div>
        </div>
        <p v-else class="empty-chart">Chưa có dữ liệu để vẽ biểu đồ trong bộ lọc này.</p>
      </section>

      <section class="admin-panel" aria-labelledby="conversion-title">
        <div class="panel-head">
          <h2 id="conversion-title">Bảng chi tiết</h2>
          <p class="cell-sub">Dữ liệu đã đồng bộ — không phải realtime tuyệt đối.</p>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr v-if="filters.type === 'clicks'">
                <th>Thời điểm</th>
                <th>Click ID</th>
                <th>Vùng</th>
                <th>Sub ID</th>
                <th>Nguồn</th>
              </tr>
              <tr v-else>
                <th>Mua lúc</th>
                <th>Sản phẩm / đơn</th>
                <th>SL</th>
                <th>Giá trị</th>
                <th>Hoa hồng</th>
                <th>Phí MCN</th>
                <th>Sub ID</th>
              </tr>
            </thead>
            <tbody v-if="filters.type === 'clicks'">
              <tr v-for="(row, index) in reportRows" :key="row.click_id || index">
                <td>{{ formatTime(row.click_time) }}</td>
                <td>{{ row.click_id || '—' }}</td>
                <td>{{ row.click_region || '—' }}</td>
                <td>{{ row.sub_id || '—' }}</td>
                <td>{{ row.direct_source || row.last_external_source || '—' }}</td>
              </tr>
              <tr v-if="!reportRows.length">
                <td colspan="5">Không có dữ liệu click trong bộ lọc này.</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="(row, index) in reportRows" :key="row.item_id || row.order_id || index">
                <td>{{ formatTime(row.purchase_time) }}</td>
                <td>
                  <div class="cell-title">{{ row.item_name || row.order_id || '—' }}</div>
                  <div class="cell-sub">{{ row.order_id ? `Đơn ${row.order_id}` : '' }}</div>
                </td>
                <td>{{ row.qty ?? '—' }}</td>
                <td>{{ formatMoney(row.order_value ?? row.price) }}</td>
                <td>{{ formatMoney(row.commission) }}</td>
                <td>{{ formatMoney(row.mcn_fee) }}</td>
                <td>{{ row.sub_id1 || row.utm || '—' }}</td>
              </tr>
              <tr v-if="!reportRows.length">
                <td colspan="7">Không có dòng chuyển đổi trong bộ lọc này.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pager">
          <button class="secondary-button" type="button" :disabled="loading || filters.page <= 1" @click="changePage(-1)">
            Trang trước
          </button>
          <span>Trang {{ filters.page }} · tổng {{ report?.meta?.total ?? '—' }}</span>
          <button
            class="secondary-button"
            type="button"
            :disabled="loading || (report?.meta && report.meta.page * report.meta.page_size >= report.meta.total)"
            @click="changePage(1)"
          >
            Trang sau
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
