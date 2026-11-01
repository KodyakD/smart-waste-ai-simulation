import type { AIStatus, Alert, AppConfig, Bin, CreateBinInput, DashboardSummary, Detection, Reading, UpdateBinInput } from './types'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new Error('Cannot reach the backend. Start FastAPI on port 8000 and try again.')
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      const detail = body.detail
      message = typeof detail === 'string' ? detail : detail?.message || detail?.next_step || message
    } catch { /* response was not JSON */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  config: () => request<AppConfig>('/config'),
  dashboard: () => request<DashboardSummary>('/dashboard'),
  bins: () => request<Bin[]>('/bins'),
  createBin: (payload: CreateBinInput) => request<Bin>('/bins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  updateBin: (id: string, payload: UpdateBinInput) => request<Bin>(`/bins/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  deleteBin: (id: string) => request<void>(`/bins/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  readings: (id: string, limit: number) => request<Reading[]>(`/bins/${encodeURIComponent(id)}/readings?limit=${limit}`),
  alerts: () => request<Alert[]>('/alerts?limit=50'),
  detections: () => request<Detection[]>('/detections?limit=50'),
  aiStatus: () => request<AIStatus>('/ai/status'),
  start: (id: string) => request<{ message: string; bin: Bin }>(`/simulation/start/${id}`, { method: 'POST' }),
  pause: (id: string) => request<{ message: string; bin: Bin }>(`/simulation/pause/${id}`, { method: 'POST' }),
  reset: (id: string) => request<{ message: string; bin: Bin }>(`/simulation/reset/${id}`, { method: 'POST' }),
  setLevel: (id: string, fill: number) => request<{ message: string; bin: Bin }>(`/simulation/level/${id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fill_percentage: fill }),
  }),
  readAlert: (id: number) => request<{ success: boolean }>(`/alerts/${id}/read`, { method: 'POST' }),
  detect: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ image_url: string; detections: Detection[]; count: number; message: string }>('/ai/detect', { method: 'POST', body: form })
  },
  imageUrl: (path: string) => `${API_BASE.replace('/api/v1', '')}${path}`,
}
