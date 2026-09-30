<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../../services/api.js'
import ShopLiveCard from '../../components/ShopLiveCard.vue'
import { formatPrice, formatRate, openExternal } from './explore-utils.js'

const keyword = ref('thời trang')
const sortType = ref('1')
const loading = ref(false)
const error = ref('')
const shops = ref([])
const page = ref(1)
const pageSize = 30

const shopDetail = ref(null)
const shopProducts = ref([])
const shopLoading = ref(false)

const count = computed(() => shops.value.length)
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => count.value >= pageSize)

async function search(resetPage = true) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = ''
  try {
    const result = await api.searchShopOffers({
      keyword: keyword.value,
      limit: pageSize,
      page: page.value,
      sortType: sortType.value,
    })
    shops.value = result.shops || []
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function openShop(shop) {
  shopDetail.value = shop
  shopProducts.value = []
  shopLoading.value = true
  error.value = ''
  try {
    const result = await api.shopProducts({ shopId: shop.shopId, page: 1, limit: 20 })
    shopProducts.value = result.products || []
    shopDetail.value = { ...shop, shopName: result.shopName || shop.name }
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    shopLoading.value = false
  }
}

function closeShop() {
  shopDetail.value = null
  shopProducts.value = []
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
  <section class="explore-tab" aria-labelledby="shops-title">
    <header class="exp-head">
      <p class="section-kicker">Khám phá</p>
      <h1 id="shops-title">Shop có hoa hồng</h1>
      <p class="hero-copy">
        Tìm shop theo từ khóa, xem hoa hồng, trạng thái live và sản phẩm đang có offer.
      </p>
    </header>

    <div class="exp-toolbar">
      <input
        v-model="keyword"
        class="exp-search"
        type="search"
        placeholder="Từ khóa shop: thời trang, gia dụng…"
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
      <span>Trang {{ page }} · {{ count }} shop</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>

    <!-- Chi tiết shop -->
    <div v-if="shopDetail" class="shop-panel">
      <div class="shop-panel-head">
        <img v-if="shopDetail.image" :src="shopDetail.image" :alt="shopDetail.name || ''" />
        <div>
          <h2>{{ shopDetail.shopName || shopDetail.name }}</h2>
          <p class="cell-sub">
            Hoa hồng <strong>{{ formatRate(shopDetail.commissionRate) }}</strong>
            <template v-if="shopDetail.rating != null"> · ★{{ shopDetail.rating }}</template>
            <template v-if="shopDetail.remainingBudget != null"> · Ngân sách còn {{ formatPrice(shopDetail.remainingBudget) }}</template>
          </p>
        </div>
        <button class="text-button" type="button" @click="closeShop">Đóng</button>
      </div>

      <ShopLiveCard
        :shop-id="shopDetail.shopId"
        :shop-name="shopDetail.shopName || shopDetail.name"
        @open-products="openShop(shopDetail)"
      />

      <h3>Sản phẩm có hoa hồng của shop</h3>
      <p v-if="shopLoading" class="cell-sub">Đang tải sản phẩm…</p>
      <div v-else-if="shopProducts.length" class="exp-grid">
        <article v-for="product in shopProducts" :key="product.itemId" class="exp-card">
          <img v-if="product.image" :src="product.image" :alt="product.name || ''" />
          <div class="exp-card-body">
            <h3>{{ product.name }}</h3>
            <p class="exp-card-sub">Sản phẩm của shop</p>
            <p class="exp-card-main">{{ formatPrice(product.price) }}</p>
            <p class="exp-card-sub">Hoa hồng <strong>{{ formatRate(product.commissionRate) }}</strong></p>
            <button class="secondary-button" type="button" @click="openExternal(product.link)">Mở sản phẩm</button>
          </div>
        </article>
      </div>
      <p v-else class="cell-sub">Shop chưa có sản phẩm offer nào (hoặc API chưa trả về).</p>
    </div>

    <!-- Danh sách shop: cùng layout card với Sản phẩm -->
    <div v-else class="exp-grid" :class="{ 'is-loading': loading }">
      <div v-if="loading" class="grid-loading" role="status" aria-live="polite">
        <span class="grid-spinner" />
        Đang tải…
      </div>
      <article v-for="shop in shops" :key="`${page}-${shop.shopId}`" class="exp-card">
        <img v-if="shop.image" :src="shop.image" :alt="shop.name || ''" />
        <div class="exp-card-body">
          <h3>{{ shop.name || 'Shop' }}</h3>
          <p class="exp-card-sub">Shop</p>
          <p class="exp-card-main">
            Hoa hồng <strong>{{ formatRate(shop.commissionRate) }}</strong>
            <template v-if="shop.rating != null"> · ★{{ shop.rating }}</template>
          </p>
          <p v-if="shop.remainingBudget != null" class="exp-card-note">
            Ngân sách còn {{ formatPrice(shop.remainingBudget) }}
          </p>
          <button class="secondary-button" type="button" @click="openShop(shop)">Xem chi tiết</button>
        </div>
      </article>
      <p v-if="!loading && !shops.length" class="cell-sub">Không có shop nào.</p>
    </div>

    <div class="exp-pager exp-pager-bottom">
      <button class="secondary-button" type="button" :disabled="loading || !canPrev" @click="changePage(-1)">Trang trước</button>
      <span>Trang {{ page }}</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>
  </section>
</template>
