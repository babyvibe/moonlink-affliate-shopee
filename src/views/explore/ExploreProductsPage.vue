<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../../services/api.js'
import { daysLeft, formatPrice, formatRate, openExternal } from './explore-utils.js'

const keyword = ref('')
const sortType = ref('1')
const loading = ref(false)
const error = ref('')
const products = ref([])
const page = ref(1)
const pageSize = 30

const count = computed(() => products.value.length)
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => count.value >= pageSize)

async function search(resetPage = true) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = ''
  try {
    const result = await api.searchProductOffers({
      keyword: keyword.value,
      limit: pageSize,
      page: page.value,
      sortType: sortType.value,
    })
    products.value = result.products || []
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

function changePage(delta) {
  const next = page.value + delta
  if (next < 1) return
  page.value = next
  search(false)
  // Cuộn lên đầu danh sách khi đổi trang
  window.requestAnimationFrame(() => {
    document.querySelector('.explore-tab')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

watch(sortType, () => search(true))
onMounted(() => search())
</script>

<template>
  <section class="explore-tab" aria-labelledby="exp-title">
    <header class="exp-head">
      <p class="section-kicker">Khám phá</p>
      <h1 id="exp-title">Sản phẩm hoa hồng cao</h1>
      <p class="hero-copy">Tìm sản phẩm theo từ khóa, sắp theo % hoa hồng.</p>
    </header>

    <div class="exp-toolbar">
      <input
        v-model="keyword"
        class="exp-search"
        type="search"
        placeholder="Từ khóa: áo len, túi xách…"
        :disabled="loading"
        @keydown.enter="search(true)"
      />
      <select v-model="sortType" :disabled="loading" aria-label="Sắp xếp">
        <option value="1">Mặc định</option>
        <option value="2">Hoa hồng cao</option>
        <option value="3">Giá thấp</option>
        <option value="4">Giá cao</option>
        <option value="5">Bán chạy</option>
      </select>
      <button class="copy-button" type="button" :disabled="loading" @click="search(true)">
        {{ loading ? 'Đang tìm…' : 'Tìm' }}
      </button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <div class="exp-pager exp-pager-top">
      <button class="secondary-button" type="button" :disabled="loading || !canPrev" @click="changePage(-1)">Trang trước</button>
      <span>Trang {{ page }} · {{ count }} SP</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>

    <div class="exp-grid" :class="{ 'is-loading': loading }">
      <div v-if="loading" class="grid-loading" role="status" aria-live="polite">
        <span class="grid-spinner" />
        Đang tải…
      </div>
      <article v-for="product in products" :key="`${page}-${product.itemId}`" class="exp-card">
        <img v-if="product.image" :src="product.image" :alt="product.name || ''" />
        <div class="exp-card-body">
          <h3>{{ product.name || 'Sản phẩm' }}</h3>
          <p class="cell-sub">{{ product.shopName }}</p>
          <p class="exp-card-main">
            {{ formatPrice(product.price) }}
            <template v-if="product.priceMin != null && product.priceMax != null && product.priceMin !== product.priceMax">
              · {{ formatPrice(product.priceMin) }} – {{ formatPrice(product.priceMax) }}
            </template>
          </p>
          <p class="exp-card-sub">
            Hoa hồng <strong>{{ formatRate(product.commissionRate) }}</strong>
            <template v-if="product.sales != null"> · Đã bán {{ product.sales }}</template>
            <template v-if="product.rating != null"> · ★{{ product.rating }}</template>
          </p>
          <p v-if="daysLeft(product.endTime) != null" class="cell-sub">
            <template v-if="daysLeft(product.endTime) > 0">Offer còn {{ daysLeft(product.endTime) }} ngày</template>
            <template v-else>Offer có thể đã hết hạn</template>
          </p>
          <button class="secondary-button" type="button" @click="openExternal(product.link)">Mở sản phẩm</button>
        </div>
      </article>
      <p v-if="!loading && !products.length" class="cell-sub">Không có sản phẩm nào.</p>
    </div>

    <div class="exp-pager exp-pager-bottom">
      <button class="secondary-button" type="button" :disabled="loading || !canPrev" @click="changePage(-1)">Trang trước</button>
      <span>Trang {{ page }}</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>
  </section>
</template>
