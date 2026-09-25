<script setup>
const props = defineProps({ links: { type: Array, default: () => [] } })
const emit = defineEmits(['clear'])

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return ''
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value))
}

async function copy(url) {
  await navigator.clipboard.writeText(url)
}
</script>

<template>
  <section v-if="links.length" class="recent-section" aria-labelledby="recent-title">
    <div class="section-title">
      <div>
        <span class="section-kicker">Vừa xem</span>
        <h2 id="recent-title">Sản phẩm gần đây</h2>
      </div>
      <button type="button" class="text-button" @click="emit('clear')">Xóa</button>
    </div>
    <ol class="recent-list">
      <li v-for="link in links" :key="link.id">
        <span class="recent-orbit">✦</span>
        <div>
          <strong>{{ link.productName || link.inputUrl }}</strong>
          <small>
            <template v-if="link.cashbackEstimate">Hoàn {{ formatPrice(link.cashbackEstimate) }}</template>
            <template v-else-if="link.commissionEstimate">Hoàn {{ formatPrice(Math.floor(Number(link.commissionEstimate) * (link.cashbackSharePercent ?? 70) / 100)) }}</template>
            <template v-else>—</template>
            · {{ new Date(link.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) }}
          </small>
        </div>
        <button class="icon-button" type="button" aria-label="Sao chép link" @click="copy(link.affiliateUrl)">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4h6v4H9zM7 8h10v12H7zM5 12H3V6a2 2 0 0 1 2-2h2" /></svg>
        </button>
      </li>
    </ol>
  </section>
</template>
