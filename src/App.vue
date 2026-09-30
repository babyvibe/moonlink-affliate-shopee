<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import StarField from './components/StarField.vue'
import GiantMoon from './components/GiantMoon.vue'
import VoidCursor from './components/VoidCursor.vue'
import LinkInputPanel from './components/LinkInputPanel.vue'
import MoonButton from './components/MoonButton.vue'
import LinkResultCard from './components/LinkResultCard.vue'
import RecentLinks from './components/RecentLinks.vue'
import BackgroundRockets from './components/BackgroundRockets.vue'
import BatchLookupPage from './views/BatchLookupPage.vue'
import ExplorePage from './views/ExplorePage.vue'
import MarketPage from './views/MarketPage.vue'
import AdminLoginPage from './admin/AdminLoginPage.vue'
import AdminReportsPage from './admin/AdminReportsPage.vue'
import { api } from './services/api.js'
import { parseShopeeUrl } from './services/shopee-url.js'

const url = ref('')
const loading = ref(false)
const error = ref('')
const hint = ref('')
const result = ref(null)
const recentLinks = ref([])

/** idle | ignition | ascent | orbit | reentry | signal */
const rocketPhase = ref('idle')
const pendingResult = ref(null)

const route = ref(window.location.hash.replace(/^#/, '') || '/')
const adminUser = ref(null)
const adminChecked = ref(false)

const isAdminArea = computed(() => route.value.startsWith('/admin'))
const showReports = computed(() => isAdminArea.value && adminUser.value)
const showLogin = computed(() => isAdminArea.value && adminChecked.value && !adminUser.value)
const pageKind = computed(() => {
  if (isAdminArea.value) return 'admin'
  if (route.value.startsWith('/batch')) return 'batch'
  if (route.value.startsWith('/explore')) return 'explore'
  if (route.value.startsWith('/market')) return 'market'
  return 'home'
})

/** Validate live khi gõ / dán — chặn ngay trên UI */
const linkCheck = computed(() => parseShopeeUrl(url.value))
const ready = computed(() => linkCheck.value.ok)

watch(
  () => url.value,
  () => {
    if (!url.value.trim()) {
      error.value = ''
      hint.value = ''
      return
    }
    if (linkCheck.value.ok) {
      error.value = ''
      hint.value = 'Link hợp lệ'
    } else {
      error.value = linkCheck.value.code === 'empty' ? '' : linkCheck.value.message
      hint.value = ''
    }
  }
)

const status = computed(() =>
  loading.value
    ? 'Đang tra mức hoàn…'
    : ready.value
      ? 'Sẵn sàng — chạm mặt trăng để xem tiền hoàn'
      : url.value.trim()
        ? 'Link chưa đúng — thử lại nhé.'
        : 'Dán link sản phẩm Shopee để xem tiền hoàn.'
)

function syncRoute() {
  route.value = window.location.hash.replace(/^#/, '') || '/'
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

let launchSeq = 0

async function createLink() {
  error.value = ''
  hint.value = ''

  // Chặn trên UI trước — không bay tên lửa, không gọi server
  const check = parseShopeeUrl(url.value)
  if (!check.ok) {
    error.value = check.message
    return
  }
  if (loading.value) return

  const seq = ++launchSeq
  loading.value = true
  result.value = null
  pendingResult.value = null

  // Chuỗi hiệu ứng: đánh lửa → cất cánh → bay vòng quỹ đạo (chờ server) → hạ cánh
  rocketPhase.value = 'ignition'
  const flightStart = Date.now()
  const minOrbitMs = 2400

  const timers = []
  const schedule = (fn, ms) => {
    timers.push(window.setTimeout(() => {
      if (seq !== launchSeq) return
      fn()
    }, ms))
  }

  schedule(() => {
    if (rocketPhase.value === 'ignition') rocketPhase.value = 'ascent'
  }, 500)
  schedule(() => {
    if (rocketPhase.value === 'ignition' || rocketPhase.value === 'ascent') rocketPhase.value = 'orbit'
  }, 1900)

  try {
    const response = await api.createLink(url.value)
    if (seq !== launchSeq) return

    const elapsed = Date.now() - flightStart
    if (elapsed < minOrbitMs) await wait(minOrbitMs - elapsed)
    if (seq !== launchSeq) return

    if (rocketPhase.value === 'ignition' || rocketPhase.value === 'ascent') {
      rocketPhase.value = 'orbit'
      await wait(800)
    }
    if (seq !== launchSeq) return

    pendingResult.value = response.link
    // tên lửa quay về mặt trăng
    rocketPhase.value = 'reentry'
    await wait(900)
    if (seq !== launchSeq) return
    // hiệu ứng thành công trên mặt trăng
    rocketPhase.value = 'signal'
    await wait(1000)
    if (seq !== launchSeq) return
    onRocketDone()
  } catch (requestError) {
    if (seq !== launchSeq) return
    const elapsed = Date.now() - flightStart
    if (elapsed < minOrbitMs) await wait(minOrbitMs - elapsed)
    timers.forEach((id) => window.clearTimeout(id))
    rocketPhase.value = 'idle'
    error.value = requestError.message
    result.value = null
    loading.value = false
  }
}

function onRocketDone() {
  rocketPhase.value = 'idle'
  loading.value = false
  if (pendingResult.value) {
    result.value = pendingResult.value
    pendingResult.value = null
    recentLinks.value = [result.value, ...recentLinks.value.filter((link) => link.id !== result.value.id)].slice(0, 10)
    requestAnimationFrame(() =>
      document.querySelector('.result-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    )
  }
}

function reset() {
  url.value = ''
  result.value = null
  pendingResult.value = null
  error.value = ''
  rocketPhase.value = 'idle'
  document.querySelector('#shopee-link')?.focus()
}

async function loadRecent() {
  try {
    const result = await api.watchlist(20)
    recentLinks.value = (result.items || []).map((item) => ({
      id: item.id,
      productName: item.productName,
      shopName: item.shopName,
      inputUrl: item.originUrl,
      affiliateUrl: item.affiliateUrl,
      cashbackEstimate: item.currentCashback,
      productPrice: item.currentPrice,
      priceDelta: item.priceDelta,
      cashbackDelta: item.cashbackDelta,
      createdAt: item.createdAt,
    }))
  } catch {
    try {
      recentLinks.value = (await api.getRecentLinks()).links
    } catch {
      /* history is supplementary */
    }
  }
}

async function clearRecent() {
  await api.clearRecentLinks()
  recentLinks.value = []
}

async function checkAdmin() {
  try {
    const me = await api.adminMe()
    adminUser.value = me.user
  } catch {
    adminUser.value = null
  } finally {
    adminChecked.value = true
  }
}

function onLoggedIn(user) {
  adminUser.value = user
  if (!route.value.startsWith('/admin/reports')) {
    window.location.hash = '#/admin/reports'
    route.value = '/admin/reports'
  }
}

function onLogout() {
  adminUser.value = null
  window.location.hash = '#/admin'
  route.value = '/admin'
}

function goConvert(e) {
  if (e) e.preventDefault()
  const isHome = route.value === '/' || route.value === '' || route.value === '/home'
  if (!isHome) {
    window.location.hash = '#/'
    route.value = '/'
  }
  requestAnimationFrame(() => {
    document.querySelector('.launcher')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => document.querySelector('#shopee-link')?.focus(), 350)
  })
}

onMounted(async () => {
  window.addEventListener('hashchange', syncRoute)
  await Promise.all([loadRecent(), checkAdmin()])
})
</script>

<template>
  <main>
    <StarField />
    <GiantMoon />
    <BackgroundRockets :phase="rocketPhase" />
    <VoidCursor />
    <div class="page-shell">
      <header class="site-header">
        <a class="brand" href="#/" aria-label="MOONLINK trang chủ">
          <span class="brand-mark">◒</span><span>MOONLINK</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <template v-if="!isAdminArea">
            <a href="#tools">Công cụ</a>
            <a href="#how">Cách dùng</a>
            <a href="#recent">Đã xem</a>
            <a href="#/admin">Đăng nhập quản trị</a>
          </template>
          <template v-else>
            <a href="#/">Về trang chủ</a>
          </template>
        </nav>
      </header>

      <!-- Public -->
      <template v-if="pageKind === 'batch'">
        <BatchLookupPage />
        <footer>
          <span>MOONLINK</span>
          <span><a href="#/">Về trang chủ</a> · <a href="#/admin">Đăng nhập quản trị</a></span>
        </footer>
      </template>

      <template v-else-if="pageKind === 'explore'">
        <ExplorePage />
        <footer>
          <span>MOONLINK</span>
          <span><a href="#/">Về trang chủ</a> · <a href="#/admin">Đăng nhập quản trị</a></span>
        </footer>
      </template>

      <template v-else-if="pageKind === 'market'">
        <MarketPage />
        <footer>
          <span>MOONLINK</span>
          <span><a href="#/">Về trang chủ</a> · <a href="#/admin">Đăng nhập quản trị</a></span>
        </footer>
      </template>

      <template v-else-if="pageKind === 'home'">
        <section id="top" class="hero" aria-labelledby="hero-title">
          <p class="eyebrow"><span /> MOONLINK <span /></p>
          <h1 id="hero-title">Mua Shopee. <em>Nhận tiền hoàn.</em></h1>
          <p class="hero-copy">
            Dán link sản phẩm Shopee, xem bạn được hoàn bao nhiêu rồi mua qua link đó.
          </p>
        </section>

        <section class="launcher" aria-label="Kiểm tra tiền hoàn">
          <LinkInputPanel
            v-model="url"
            :status="status"
            :error="error"
            :hint="hint"
            :valid="ready"
            :loading="loading"
            @submit="createLink"
          />
          <MoonButton :ready="ready" :loading="loading" :phase="rocketPhase" @launch="createLink" />
        </section>

        <LinkResultCard v-if="result" :link="result" @new-link="reset" />

        <section id="how" class="how-section" aria-labelledby="how-title">
          <p class="section-kicker">Cách dùng</p>
          <h2 id="how-title">3 bước</h2>
          <div class="steps">
            <article>
              <span>01</span>
              <h3>Dán link</h3>
              <p>Sao chép link sản phẩm trên Shopee và dán vào ô bên trên.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Xem tiền hoàn</h3>
              <p>Hệ thống báo bạn sẽ được hoàn bao nhiêu cho sản phẩm đó.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Mua &amp; nhận hoàn</h3>
              <p>Bấm mua qua link, đơn thành công sẽ được hoàn tiền.</p>
            </article>
          </div>
        </section>

        <!-- Landing: các công cụ khác (không tách menu) -->
        <section id="tools" class="tools-section" aria-labelledby="tools-title">
          <p class="section-kicker">Công cụ</p>
          <h2 id="tools-title">Thêm công cụ cho người làm affiliate</h2>
          <div class="tool-cards">
            <a class="tool-card" href="#/" @click="goConvert">
              <span class="tool-icon">📈</span>
              <h3>Giá &amp; so sánh</h3>
              <p>Chart giá 7/30/90 ngày, so TikTok &amp; Lazada — ngay sau khi kiểm tra link.</p>
            </a>
            <a class="tool-card" href="#/batch">
              <span class="tool-icon">⚡</span>
              <h3>Tra nhanh</h3>
              <p>Dán 100 link / ID một lúc — ra bảng tiền hoàn + link.</p>
            </a>
            <a class="tool-card" href="#/explore?tab=products">
              <span class="tool-icon">🛍</span>
              <h3>Sản phẩm</h3>
              <p>Tìm sản phẩm hoa hồng cao theo từ khóa.</p>
            </a>
            <a class="tool-card" href="#/explore?tab=campaigns">
              <span class="tool-icon">🎯</span>
              <h3>Chiến dịch</h3>
              <p>Chương trình KOL, brand đang chạy trên Shopee.</p>
            </a>
            <a class="tool-card" href="#/explore?tab=shops">
              <span class="tool-icon">📡</span>
              <h3>Shop đang live</h3>
              <p>Biết shop nào đang phát trực tiếp, khung giờ hay live.</p>
            </a>
            <a class="tool-card" href="#/explore?tab=food">
              <span class="tool-icon">🍜</span>
              <h3>Quán ăn &amp; Đơn food</h3>
              <p>Thông tin quán ShopeeFood, lịch sử đơn đã đặt (cần cookie).</p>
            </a>
            <a class="tool-card" href="#/market">
              <span class="tool-icon">🌊</span>
              <h3>Ngách</h3>
              <p>Phân tích thị trường, cạnh tranh, so 2–3 từ khóa.</p>
            </a>
          </div>
        </section>

        <div id="recent">
          <RecentLinks :links="recentLinks" @clear="clearRecent" />
        </div>
        <footer>
          <span>MOONLINK</span>
          <span><a href="#/admin">Đăng nhập quản trị</a></span>
        </footer>
      </template>

      <!-- Admin -->
      <template v-else>
        <AdminLoginPage v-if="showLogin" @logged-in="onLoggedIn" />
        <AdminReportsPage v-else-if="showReports" :user="adminUser" @logout="onLogout" />
        <p v-else class="admin-lead">Đang kiểm tra phiên đăng nhập…</p>
      </template>
    </div>
  </main>
</template>
