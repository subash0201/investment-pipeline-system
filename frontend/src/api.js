// Thin wrapper around fetch for the Django REST API.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const KEY = 'ipts.session'

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

// "Remember me" keeps the session after the browser closes; otherwise it ends with the tab.
export function saveSession(session, remember) {
  clearSession()
  ;(remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session))
}

// Keeps the stored token but replaces the cached user (after a profile edit).
export function updateSessionUser(user) {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const session = JSON.parse(store.getItem(KEY) || 'null')
      if (session) store.setItem(KEY, JSON.stringify({ ...session, user }))
    } catch {
      /* ignore unreadable storage */
    }
  }
}

export function clearSession() {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}

export class ApiError extends Error {
  constructor(status, data) {
    super(describe(data) || `Request failed (${status})`)
    this.status = status
    this.data = data && typeof data === 'object' ? data : {}
  }
  // First message for a field, e.g. error.field('name')
  field(name) {
    const value = this.data[name]
    return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : undefined
  }
}

function describe(data) {
  if (!data) return ''
  if (typeof data === 'string') return data.length < 200 ? data : ''
  if (data.detail) return String(data.detail)
  const first = Object.values(data)[0]
  return Array.isArray(first) ? String(first[0]) : typeof first === 'string' ? first : ''
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function request(method, path, body, { raw = false } = {}) {
  const session = loadSession()
  const headers = {}
  if (session?.token) headers.Authorization = `Token ${session.token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, { detail: 'Cannot reach the server. Check that the API is running.' })
  }
  if (response.status === 401 && session?.token) onUnauthorized()
  if (raw && response.ok) return response
  if (response.status === 204) return null

  const text = await response.text()
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* not JSON: keep the text */
  }
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),

  // Fetches a file with the auth header and hands it to the browser as a download.
  async download(path, fallbackName) {
    const response = await request('GET', path, undefined, { raw: true })
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || fallbackName
    const url = URL.createObjectURL(await response.blob())
    const link = Object.assign(document.createElement('a'), { href: url, download: name })
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}

export function query(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}
