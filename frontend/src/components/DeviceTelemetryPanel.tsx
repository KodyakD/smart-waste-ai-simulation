import type { AppConfig, Bin } from '../types'

type Props = { bin: Bin; config: AppConfig }

function timeAgo(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export default function DeviceTelemetryPanel({ bin, config }: Props) {
  const echoMicroseconds = (2 * bin.distance_cm) / config.simulation.speed_of_sound_cm_per_us
  const payload = {
    distance_cm: bin.distance_cm,
    fill_percentage: bin.fill_percentage,
    status: bin.status,
  }
  const endpoint = `POST /api/v1/simulation/level/${encodeURIComponent(bin.id)}`

  return (
    <section className="panel device-telemetry-panel">
      <div className="panel-heading">
        <div><div className="panel-kicker">VIRTUAL DEVICE TELEMETRY</div><h2>ESP32 payload</h2></div>
        <span className={`device-state ${bin.is_running ? 'running' : 'paused'}`}>{bin.is_running ? 'Running' : 'Paused'}</span>
      </div>
      <div className="device-telemetry-grid">
        <div className="device-fact"><span>Update interval</span><strong>{config.simulation.interval_seconds} s</strong></div>
        <div className="device-fact"><span>Last backend reading</span><strong>{timeAgo(bin.last_updated)}</strong><small>{new Date(bin.last_updated).toLocaleString()}</small></div>
        <div className="device-fact"><span>Ultrasonic round-trip echo</span><strong>{echoMicroseconds.toFixed(1)} µs</strong></div>
        <div className="device-fact"><span>HTTP destination</span><strong>{endpoint}</strong><small>Software endpoint only · no physical ESP32 connected</small></div>
      </div>
      <div className="device-payload">
        <div className="micro-label">CURRENT BIN PAYLOAD</div>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </section>
  )
}
