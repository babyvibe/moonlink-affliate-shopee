<script setup>
import { computed, ref } from 'vue'

const props = defineProps({ link: { type: Object, required: true } })
const emit = defineEmits(['new-link'])
const copied = ref(false)
const showDetail = ref(false)

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value))
}

const cashback = computed(() => {
  if (props.link.cashbackEstimate != null) return props.link.cashbackEstimate
  const commission = props.link.commissionEstimate
  const share = props.link.cashbackSharePercent ?? 70
  if (commission == null) return null
  return Math.floor(Number(commission) * share / 100)
})

const hasCashback = computed(() => cashback.value != null && Number(cashback.value) > 0)
const sharePercent = computed(() => props.link.cashbackSharePercent ?? 70)

async function copy() {
  await navigator.clipboard.writeText(props.link.affiliateUrl)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1800)
}
</script>

<template>
  <section class="result-card" aria-live="polite">
    <div class="result-topline result-signal"><span class="success-dot">✓</span> Đã tra xong</div>

    <div class="cashback-card" :class="{ 'is-empty': !hasCashback }">
      <div class="cashback-label">Bạn được hoàn</div>
      <div class="cashback-amount">
        <template v-if="hasCashback">{{ formatPrice(cashback) }}</template>
        <template v-else>Chưa có mức hoàn</template>
      </div>
      <div class="cashback-meta">
        <template v-if="hasCashback">
          Dùng link bên dưới khi mua hàng · hoàn {{ sharePercent }}% hoa hồng
        </template>
        <template v-else>
          Sản phẩm này chưa có mức hoàn. Thử sản phẩm khác nhé.
        </template>
      </div>
    </div>

    <article v-if="link.productName" class="product-preview">
      <img v-if="link.productImageUrl" :src="link.productImageUrl" :alt="link.productName" />
      <div>
        <span class="product-shop">{{ link.shopName }}</span>
        <h3>{{ link.productName }}</h3>
        <strong v-if="link.productPrice">{{ formatPrice(link.productPrice) }}</strong>
      </div>
    </article>

    <div class="result-link">
      <span>Link mua hàng của bạn</span>
      <code>{{ link.affiliateUrl }}</code>
    </div>
    <div class="result-actions">
      <button class="copy-button" type="button" @click="copy">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4h6v4H9zM7 8h10v12H7zM5 12H3V6a2 2 0 0 1 2-2h2" /></svg>
        {{ copied ? 'Đã sao chép' : 'Sao chép link' }}
      </button>
      <a class="open-button" :href="link.originUrl || link.normalizedUrl" target="_blank" rel="noopener noreferrer">
        Mua trên Shopee <span aria-hidden="true">↗</span>
      </a>
      <button class="text-button" type="button" @click="emit('new-link')">Kiểm tra SP khác</button>
    </div>

    <button class="text-button detail-toggle" type="button" @click="showDetail = !showDetail">
      {{ showDetail ? 'Ẩn chi tiết' : 'Xem cách tính' }}
    </button>
    <div v-if="showDetail" class="cashback-breakdown">
      <div class="bd-row"><span>Hoa hồng sàn</span><strong>{{ formatPrice(link.shopeeComFinal) }}</strong></div>
      <div class="bd-row"><span>Hoa hồng shop (Xtra)</span><strong>{{ formatPrice(link.sellerComFinal) }}</strong></div>
      <div class="bd-row">
        <span>Tổng hoa hồng</span>
        <strong>{{ formatPrice(
          link.sellerComFinal != null || link.shopeeComFinal != null
            ? Number(link.sellerComFinal || 0) + Number(link.shopeeComFinal || 0)
            : link.commissionEstimate
        ) }}</strong>
      </div>
      <div class="bd-row bd-total">
        <span>Hoàn cho bạn ({{ sharePercent }}%)</span>
        <strong>{{ formatPrice(cashback) }}</strong>
      </div>
      <p class="cashback-note">Số tiền hoàn dự kiến. Đơn thành công mới được ghi nhận chính thức.</p>
    </div>
  </section>
</template>
