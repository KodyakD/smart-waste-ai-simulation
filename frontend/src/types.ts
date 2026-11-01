export type BinStatus = 'normal' | 'almost_full' | 'full'

export interface AppConfig {
  simulation: {
    interval_seconds: number
    full_distance_cm: number
    speed_of_sound_cm_per_us: number
    max_readings: number
  }
  thresholds: { almost_full: number; full: number }
  ai: {
    configured: boolean
    model_path: string
    architecture: string
    device: string
    confidence_threshold: number
    classes: string[]
  }
  app: { name: string; environment: string }
}

export interface Bin {
  id: string
  name: string
  location: string
  fill_percentage: number
  distance_cm: number
  status: BinStatus
  is_running: boolean
  last_updated: string
}

export interface Reading {
  id: number
  bin_id: string
  fill_percentage: number
  distance_cm: number
  status: BinStatus
  created_at: string
}

export interface Alert {
  id: number
  bin_id: string | null
  bin_name?: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface Detection {
  id: number
  filename: string
  original_filename: string
  class_name: string
  confidence: number
  risk_level: string
  status: string
  bbox_json: string
  created_at: string
}

export interface DashboardSummary {
  total_bins: number
  average_fill: number
  full_bins: number
  active_simulations: number
  unread_alerts: number
  total_detections: number
  total_readings: number
  recent_alerts: Alert[]
  bins: Bin[]
}

export interface AIStatus {
  configured: boolean
  model_path: string
  message: string
  classes: string[]
}
