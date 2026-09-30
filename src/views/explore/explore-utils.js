export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export function formatRate(rate) {
  if (rate == null) return '—'
  return `${(Number(rate) * 100).toFixed(1)}%`
}

export function daysLeft(endTime) {
  if (!endTime) return null
  const end = Number(endTime) > 1e12 ? Number(endTime) : Number(endTime) * 1000
  return Math.ceil((end - Date.now()) / 86_400_000)
}

export function openExternal(link) {
  if (link) window.open(link, '_blank', 'noopener noreferrer')
}
