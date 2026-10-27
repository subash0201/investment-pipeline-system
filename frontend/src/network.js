// Shared helpers for the investment-network screens.
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// ---- reference data (actor types, collections, pillars...), loaded once ----
let referenceCache = null
let referencePromise = null

export function useReference() {
  const [data, setData] = useState(referenceCache)
  useEffect(() => {
    if (referenceCache) return undefined
    let live = true
    referencePromise = referencePromise || api.get('/reference/').then((value) => (referenceCache = value))
    referencePromise.then((value) => live && setData(value), () => { referencePromise = null })
    return () => {
      live = false
    }
  }, [])
  return data
}

export const labelOf = (rows, key) => rows?.find((row) => row.key === key)?.label || key

// ---- money: catalogue costing is in NRs; large figures read best in billions ----
export function nrsBillion(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '—'
  const billions = Number(value) / 1e9
  return `NRs ${billions.toLocaleString('en-US', { maximumFractionDigits: digits })} bn`
}

export function nrs(value) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  if (amount >= 1e9) return nrsBillion(amount)
  if (amount >= 1e7) return `NRs ${(amount / 1e7).toLocaleString('en-US', { maximumFractionDigits: 1 })} crore`
  return `NRs ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export const pct = (part, whole) => (Number(whole) ? Math.round((100 * Number(part || 0)) / Number(whole)) : 0)

// ---- compare list: up to four portfolio ids, kept in this browser ----
const COMPARE_KEY = 'ipts.compare'
const COMPARE_EVENT = 'ipts-compare'
export const COMPARE_MAX = 4

function readCompare() {
  try {
    const ids = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]')
    return Array.isArray(ids) ? ids.filter(Number.isInteger).slice(0, COMPARE_MAX) : []
  } catch {
    return []
  }
}

function writeCompare(ids) {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids))
  } catch {
    /* storage unavailable: the list just won't persist */
  }
  window.dispatchEvent(new Event(COMPARE_EVENT))
}

export function useCompare() {
  const [ids, setIds] = useState(readCompare)
  useEffect(() => {
    const sync = () => setIds(readCompare())
    window.addEventListener(COMPARE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const toggle = useCallback((id) => {
    const current = readCompare()
    if (current.includes(id)) writeCompare(current.filter((value) => value !== id))
    else if (current.length < COMPARE_MAX) writeCompare([...current, id])
    else return false
    return true
  }, [])
  const clear = useCallback(() => writeCompare([]), [])
  return { ids, toggle, clear, full: ids.length >= COMPARE_MAX }
}

// ---- sharing ----
export const portfolioUrl = (id) => `${window.location.origin}/portfolios/${id}`

export function shareLink(channel, url, title) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return {
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
  }[channel]
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
