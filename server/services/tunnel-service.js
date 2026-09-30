import { spawn } from 'node:child_process'

/**
 * Cloudflare Quick Tunnel — docs: README mục 6️⃣
 * Spawn `cloudflared tunnel --url http://127.0.0.1:<port>`, đọc URL trycloudflare.com
 * từ stdout rồi trả về UI admin (tab Kiểm thử).
 *
 * Chỉ admin được start/stop. Mỗi lúc 1 tunnel.
 */

let proc = null
let state = {
  status: 'stopped', // stopped | starting | running | error
  url: '',
  error: '',
  startedAt: null,
  target: '',
}

function setState(patch) {
  state = { ...state, ...patch }
}

function parseUrl(chunk) {
  // Dòng in ra: "https://<random>.trycloudflare.com"
  const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
  return match ? match[0] : null
}

export function getTunnelState() {
  return { ...state }
}

export function startTunnel({ target } = {}) {
  if (proc && state.status === 'running') {
    return { ok: true, ...state, message: 'Tunnel đang chạy.' }
  }
  if (proc && state.status === 'starting') {
    return { ok: true, ...state, message: 'Đang khởi động tunnel…' }
  }

  // Mặc định trỏ tới Vite (:5173) — Vite proxy /api → :3000
  const url = String(target || 'http://127.0.0.1:5173')
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) {
    return { ok: false, message: 'Chỉ cho phép trỏ tunnel tới localhost.' }
  }

  setState({
    status: 'starting',
    url: '',
    error: '',
    startedAt: new Date().toISOString(),
    target: url,
  })

  // Chạy npx cloudflared (không cần cài đặt sẵn)
  proc = spawn('npx', ['--yes', 'cloudflared@latest', 'tunnel', '--url', url], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // Windows: npx là .cmd — cần shell để spawn được
    shell: process.platform === 'win32',
  })

  let buffer = ''
  const onData = (chunk) => {
    buffer += chunk.toString()
    const found = parseUrl(buffer)
    if (found && state.status !== 'running') {
      setState({ status: 'running', url: found })
    }
  }

  proc.stdout?.on('data', onData)
  proc.stderr?.on('data', onData)

  proc.on('error', (error) => {
    proc = null
    setState({
      status: 'error',
      error: error.message,
    })
  })

  proc.on('exit', (code) => {
    proc = null
    setState({
      status: 'stopped',
      url: '',
      error: code && code !== 0 ? `Tunnel đã dừng (exit ${code}).` : '',
    })
  })

  return { ok: true, ...state, message: 'Đang khởi động tunnel…' }
}

export function stopTunnel() {
  if (!proc) {
    setState({ status: 'stopped', url: '', error: '' })
    return { ok: true, message: 'Tunnel đã dừng.' }
  }
  try {
    proc.kill('SIGTERM')
  } catch {
    // bỏ qua
  }
  proc = null
  setState({ status: 'stopped', url: '', error: '' })
  return { ok: true, message: 'Đã dừng tunnel.' }
}
