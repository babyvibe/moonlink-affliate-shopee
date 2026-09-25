<script setup>
import { ref } from 'vue'
import { api } from '../services/api.js'

const emit = defineEmits(['logged-in'])
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = 'Nhập đủ tài khoản và mật khẩu.'
    return
  }
  loading.value = true
  try {
    const result = await api.adminLogin(username.value.trim(), password.value)
    emit('logged-in', result.user)
  } catch (requestError) {
    error.value = requestError.message
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="admin-login" aria-labelledby="admin-login-title">
    <p class="section-kicker">Vùng vận hành</p>
    <h1 id="admin-login-title">Đăng nhập Admin</h1>
    <p class="admin-lead">Trang này dành cho vận hành. Mọi phiên đăng nhập đều được ghi nhật ký.</p>

    <form class="admin-form" @submit.prevent="submit">
      <label for="admin-user">Tài khoản</label>
      <input
        id="admin-user"
        v-model="username"
        autocomplete="username"
        inputmode="text"
        required
        :disabled="loading"
        placeholder="admin"
      />

      <label for="admin-pass">Mật khẩu</label>
      <input
        id="admin-pass"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        :disabled="loading"
        placeholder="••••••••••"
      />

      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <button class="copy-button" type="submit" :disabled="loading">
        {{ loading ? 'Đang xác thực…' : 'Đăng nhập' }}
      </button>
    </form>

    <p class="admin-note">
      Bảo mật: mật khẩu lưu dạng hash scrypt, cookie phiên HttpOnly + SameSite=Strict,
      kiểm tra Origin. Chỉ khóa đăng nhập sau <strong>5 lần sai</strong> (15 phút).
    </p>
  </section>
</template>
