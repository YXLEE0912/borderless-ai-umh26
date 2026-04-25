/**
 * Borderless AI - Frontend API Client
 * Drop this into your frontend src/lib/api.js
 * 
 * Usage:
 *   import api from './lib/api'
 *   const session = await api.createSession()
 *   const result  = await api.verifyEntity(session.session_id, { company_name: 'Acme Sdn Bhd', ... })
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ─── Generic fetch wrapper ───────────────────
async function request(method, path, body = null, params = null) {
  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

const get  = (path, params) => request('GET',  path, null, params)
const post = (path, body)   => request('POST', path, body)

// ─── API Surface ─────────────────────────────
const api = {

  // Health
  ping: () => get('/health'),

  // Session
  createSession:  ()          => post('/sessions'),
  getSession:     (sid)       => get(`/sessions/${sid}`),

  // Step 1 — Entity
  verifyEntity: (sid, { company_name, registration_number, director_nric }) =>
    post('/entity/verify', { session_id: sid, company_name, registration_number, director_nric }),

  uploadSSM: (sid, file) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE_URL}/entity/upload-ssm?session_id=${sid}`, {
      method: 'POST', body: form,
    }).then(r => r.json())
  },

  // Step 2 — Consignee
  addConsignee: (sid, data) =>
    post('/consignee/add', { session_id: sid, ...data }),

  // Step 3 — HS Code
  classifyHSCode: (sid, { product_description, destination_country, product_category }) =>
    post('/classification/hs-code', { session_id: sid, product_description, destination_country, product_category }),

  // Step 4 — Permits
  checkPermits: (sid, { hs_code, product_type, destination_country }) =>
    post('/permits/check', { session_id: sid, hs_code, product_type, destination_country }),

  // Step 5 — Digital Access
  setupDigitalAccess: (sid, company_brn, customs_agent_code = null) =>
    post('/digital-access/setup', null,
      { session_id: sid, company_brn, ...(customs_agent_code && { customs_agent_code }) }),

  // Step 6 — Valuation
  calculateValuation: (sid, { fob_value_myr, destination_country, freight_quote_myr, insurance_rate }) =>
    post('/valuation/calculate', { session_id: sid, fob_value_myr, destination_country, freight_quote_myr, insurance_rate }),

  // Step 7 — Logistics
  setupLogistics: (sid, data) =>
    post('/logistics/setup', { session_id: sid, ...data }),

  // Step 8 — Trade Docs
  generateDocs: (sid) =>
    post('/trade-docs/generate', null, { session_id: sid }),

  // Step 9 — K2
  submitK2: (sid) =>
    post('/customs/submit-k2', null, { session_id: sid }),

  // Chat (non-streaming)
  chat: (sid, message) =>
    post('/chat', { session_id: sid, message, stream: false }),

  // Chat (streaming SSE)
  chatStream: (sid, message, onChunk, onDone) => {
    const ctrl = new AbortController()
    fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, message, stream: true }),
      signal: ctrl.signal,
    }).then(async res => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) { onDone?.(); break }
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { onChunk(JSON.parse(line.slice(6)).text) } catch (_) {}
          }
        }
      }
    }).catch(e => { if (e.name !== 'AbortError') console.error(e) })
    return () => ctrl.abort()   // returns cancel fn
  },

  // Helpers
  getChecklist:    (sid) => get(`/checklist/${sid}`),
  getDocStatus:    (sid) => get(`/documents/status/${sid}`),
  getLandedCost:   (sid) => get(`/landed-cost/${sid}`),
}

export default api


// ─── React hook (optional) ────────────────────
// import { useState, useEffect, useCallback } from 'react'
//
// export function useTradeSession() {
//   const [sessionId, setSessionId] = useState(null)
//   const [session, setSession] = useState(null)
//
//   const init = useCallback(async () => {
//     const s = await api.createSession()
//     setSessionId(s.session_id)
//   }, [])
//
//   useEffect(() => { init() }, [init])
//
//   const refresh = useCallback(async () => {
//     if (!sessionId) return
//     setSession(await api.getSession(sessionId))
//   }, [sessionId])
//
//   return { sessionId, session, refresh, api }
// }
