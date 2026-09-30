<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import ExploreProductsPage from './explore/ExploreProductsPage.vue'
import ExploreShopsPage from './explore/ExploreShopsPage.vue'
import ExploreCampaignsPage from './explore/ExploreCampaignsPage.vue'
import ExploreFoodPage from './explore/ExploreFoodPage.vue'

const TABS = [
  { id: 'products', label: 'Sản phẩm', icon: '🛍' },
  { id: 'shops', label: 'Shop', icon: '🏪' },
  { id: 'campaigns', label: 'Chiến dịch', icon: '🎯' },
  { id: 'food', label: 'Quán ăn', icon: '🍜' },
]

const tab = ref('products')

function readTabFromHash() {
  const hash = window.location.hash.replace(/^#/, '')
  const query = hash.split('?')[1] || ''
  const params = new URLSearchParams(query)
  const t = params.get('tab')
  if (t && TABS.some((item) => item.id === t)) {
    tab.value = t
    return true
  }
  return false
}

function setTab(id) {
  tab.value = id
  // đồng bộ lên hash để share link / back/forward hoạt động
  const next = `#/explore?tab=${id}`
  if (window.location.hash !== next) window.location.hash = next
}

function onHashChange() {
  if (!window.location.hash.startsWith('#/explore')) return
  readTabFromHash()
}

onMounted(() => {
  readTabFromHash()
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})

// Khi tab đổi từ hash (không qua setTab) vẫn render component
watch(tab, () => {
  // không cần load gì thêm — component tự onMounted
})
</script>

<template>
  <section class="explore-page">
    <!-- Tab nav riêng cho Khám phá -->
    <nav class="explore-tabs" role="tablist" aria-label="Khám phá">
      <button
        v-for="item in TABS"
        :key="item.id"
        class="explore-tab-btn"
        :class="{ 'is-active': tab === item.id }"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        @click="setTab(item.id)"
      >
        <span class="explore-tab-icon">{{ item.icon }}</span>
        {{ item.label }}
      </button>
    </nav>

    <component :is="{
      products: ExploreProductsPage,
      shops: ExploreShopsPage,
      campaigns: ExploreCampaignsPage,
      food: ExploreFoodPage,
    }[tab]" :key="tab" />
  </section>
</template>
