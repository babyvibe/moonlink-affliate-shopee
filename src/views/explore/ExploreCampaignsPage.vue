<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../../services/api.js'
import { daysLeft, formatRate, openExternal } from './explore-utils.js'

const keyword = ref('')
const sortType = ref('1')
const loading = ref(false)
const error = ref('')
const campaigns = ref([])
const page = ref(1)
const pageSize = 30

const count = computed(() => campaigns.value.length)
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => count.value >= pageSize)

async function search(resetPage = true) {
  if (resetPage) page.value = 1
  loading.value = true
  error.value = ''
  try {
    const result = await api.searchShopeeOffers({
      keyword: keyword.value,
      limit: pageSize,
      page: page.value,
      sortType: sortType.value,
    })
    campaigns.value = result.offers || []
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
  <section class="explore-tab" aria-labelledby="camp-title">
    <header class="exp-head">
      <p class="section-kicker">Khám phá</p>
      <h1 id="camp-title">Chiến dịch Shopee</h1>
      <p class="hero-copy">
        Các chương trình đang chạy trên sàn (KOL, brand…) — kèm % hoa hồng và thời hạn.
      </p>
    </header>

    <div class="exp-toolbar">
      <input
        v-model="keyword"
        class="exp-search"
        type="search"
        placeholder="Từ khóa chiến dịch…"
        :disabled="loading"
        @keydown.enter="search(true)"
      />
      <select v-model="sortType" :disabled="loading" aria-label="Sắp xếp">
        <option value="1">Mặc định</option>
        <option value="2">Hoa hồng cao</option>
        <option value="5">Nổi bật</option>
      </select>
      <button class="copy-button" type="button" :disabled="loading" @click="search(true)">
        {{ loading ? 'Đang tìm…' : 'Tìm' }}
      </button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <div class="exp-pager exp-pager-top">
      <button class="secondary-button" type="button" :disabled="loading || !canPrev" @click="changePage(-1)">Trang trước</button>
      <span>Trang {{ page }} · {{ count }} chiến dịch</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>

    <!-- Chiến dịch: cùng layout card với Sản phẩm -->
    <div class="exp-grid" :class="{ 'is-loading': loading }">
      <div v-if="loading" class="grid-loading" role="status" aria-live="polite">
        <span class="grid-spinner" />
        Đang tải…
      </div>
      <article v-for="offer in campaigns" :key="offer.name" class="exp-card">
        <img v-if="offer.image" :src="offer.image" :alt="offer.name || ''" />
        <div class="exp-card-body">
          <h3>{{ offer.name || 'Chiến dịch' }}</h3>
          <p class="exp-card-sub">{{ offer.type || 'Chiến dịch' }}</p>
          <p class="exp-card-main">
            Hoa hồng <strong>{{ formatRate(offer.commissionRate) }}</strong>
          </p>
          <p v-if="daysLeft(offer.endTime) != null" class="exp-card-note">
            <template v-if="daysLeft(offer.endTime) > 0">Còn {{ daysLeft(offer.endTime) }} ngày</template>
            <template v-else>Có thể đã hết hạn</template>
          </p>
          <button class="secondary-button" type="button" @click="openExternal(offer.link)">
            Mở chiến dịch
          </button>
        </div>
      </article>
      <p v-if="!loading && !campaigns.length" class="cell-sub">Không có chiến dịch nào.</p>
    </div>

    <div class="exp-pager exp-pager-bottom">
      <button class="secondary-button" type="button" :disabled="loading || !canPrev" @click="changePage(-1)">Trang trước</button>
      <span>Trang {{ page }}</span>
      <button class="secondary-button" type="button" :disabled="loading || !canNext" @click="changePage(1)">Trang sau</button>
    </div>
  </section>
</template>
