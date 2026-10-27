import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from './api.js'

export const THRESHOLD = 70

export const STAGES = [
  ['DRAFT', 'Draft'],
  ['REGISTERED', 'Registered'],
  ['UNDER_REVIEW', 'Under Review'],
  ['PENDING_APPROVAL', 'Pending Approval'],
  ['APPROVED', 'Approved'],
  ['INVESTMENT_READY', 'Investment Ready'],
  ['LISTED', 'Listed in Registry'],
]
export const STAGE_LABEL = { ...Object.fromEntries(STAGES), REJECTED: 'Rejected' }

// Chip colour for every stage and status label used in the app.
const TONES = {
  Draft: 'gray', Registered: 'blue', 'Under Review': 'blue', 'In progress': 'blue', Funded: 'blue',
  'Pending Approval': 'amber', Pending: 'amber', Developing: 'amber', 'On hold': 'amber',
  Approved: 'green', 'Investment Ready': 'green', 'Investment ready': 'green', 'Listed in Registry': 'green',
  Listed: 'green', Active: 'green', Completed: 'green', Current: 'green', Above: 'green',
  Rejected: 'red', 'Not ready': 'red', Below: 'red',
  'Not started': 'gray', Delisted: 'gray', 'Not tagged': 'gray',
}
export const tone = (label) => TONES[label] || 'gray'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-08-12" or an ISO timestamp -> "12 Aug 2026"
export function fmtDate(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function fmtDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  const hours = date.getHours()
  const clock = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
  return `${fmtDate(value)}, ${clock}`
}

// "2 hours ago", "Yesterday", "3 days ago", "2 weeks ago"
export function ago(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const days = Math.ceil((startOfToday - date.getTime()) / 86400000)
  if (days <= 0) {
    const hours = Math.round(minutes / 60)
    return hours < 6 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : 'Today'
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 60) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }
  return fmtDate(value)
}

// Amounts are Nepalese rupees throughout the platform.
export const CURRENCY = 'NRs'

export const money = (value) => `${CURRENCY} ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export function moneyShort(value) {
  const amount = Number(value || 0)
  if (amount >= 1e9) return `${CURRENCY} ${(amount / 1e9).toFixed(1).replace(/\.0$/, '')} bn`
  if (amount >= 1e6) return `${CURRENCY} ${(amount / 1e6).toFixed(1).replace(/\.0$/, '')} M`
  if (amount >= 1e3) return `${CURRENCY} ${(amount / 1e3).toFixed(0)} K`
  return money(amount)
}

export const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const signed = (value) => (value > 0 ? `+${value}` : `${value}`)

// Loads `path` and reloads whenever it changes. Pass null to skip.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false })
      return undefined
    }
    let live = true
    setState((previous) => ({ ...previous, error: null, loading: true }))
    api.get(path).then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState({ data: null, error, loading: false }),
    )
    return () => {
      live = false
    }
  }, [path, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { ...state, reload }
}

// A one-off success message handed over by the previous screen via navigate(..., { state: { flash } }).
export function useFlash() {
  return useLocation().state?.flash || null
}
