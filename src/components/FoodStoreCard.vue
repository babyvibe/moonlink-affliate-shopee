<script setup>
import { ref } from 'vue'
import { api } from '../services/api.js'

const input = ref('')
const loading = ref(false)
const error = ref('')
const stores = ref([])
const note = ref('')

async function lookup() {
  const raw = input.value.trim()
  if (!raw) {
    error.value = 'Nhập link hoặc mã quán ShopeeFood.'
    return
  }
  loading.value = true
  error.value = ''
  stores.value = []
  note.value = ''
  try {
    // thử resolve link trước, nếu là mã thuần thì gọi stores
    let result
    if (/^https?:\/\//i.test(raw)) {
      result = await api.foodResolve(raw)
    } else {
      result = await api.foodStores(raw)
    }
    stores.value = result.stores || []
    if (!stores.value.length) {
      note.value = 'Không tìm thấy quán này.'
    }
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="food-store-card">
    <div class="explore-filters">
      <input
        v-model="input"
        type="search"
        placeholder="Link ShopeeFood hoặc mã quán (vd …com-abc__123)"
        :disabled="loading"
        @keydown.enter="lookup"
      />
      <button class="copy-button" type="button" :disabled="loading" @click="lookup">
        {{ loading ? 'Đang tra…' : 'Tìm quán' }}
      </button>
    </div>

    <p class="cell-sub food-note">
      ⚠️ Link ShopeeFood <strong>chưa hỗ trợ tạo link hoàn tiền</strong> — chỉ xem thông tin quán.
    </p>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="note" class="cell-sub">{{ note }}</p>

    <article v-for="store in stores" :key="store.restaurantId" class="offer-card food-result">
      <div class="offer-body">
        <h3>
          <span class="sl-dot" :class="{ 'is-live': store.isOpen }" />
          {{ store.name || `Quán ${store.restaurantId}` }}
        </h3>
        <p class="cell-sub">{{ store.address || 'Chưa rõ địa chỉ' }}</p>
        <p class="offer-rate">
          <strong>{{ store.isOpen ? '🟢 MỞ CỬA' : store.isOpen === false ? '⚪ ĐÓNG CỬA' : 'Chưa rõ trạng thái' }}</strong>
          <template v-if="store.openHours"> · {{ store.openHours }}</template>
        </p>
        <p class="cell-sub">
          <template v-if="store.isQualityMerchant">⭐ Quán chất lượng · </template>
          <template v-if="store.isPickup">🛍 Có mang về</template>
        </p>
        <a
          v-if="store.restaurantUrl"
          class="secondary-button"
          :href="store.restaurantUrl"
          target="_blank"
          rel="noopener noreferrer"
        >Mở đặt món ↗</a>
      </div>
    </article>
  </div>
</template>
