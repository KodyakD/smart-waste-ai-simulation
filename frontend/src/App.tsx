import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Activity, AlertOctagon, AlertTriangle, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, Cpu, Database, Gauge, LayoutDashboard, Leaf, Menu,
  Pause, Play, Radio, RefreshCw, ScanSearch, Settings2, SlidersHorizontal,
  Sparkles, Trash2, X,
} from 'lucide-react'
import { api } from './api'
import { useConfig } from './ConfigContext'
import ImmersiveBinScene from './ImmersiveBinScene'
import DeviceTelemetryPanel from './components/DeviceTelemetryPanel'
import BinsPage from './pages/BinsPage'
import AIDetectionPage from './pages/AIDetectionPage'
import PageIntro from './components/PageIntro'
import type { AIStatus, Alert as AlertItem, AppConfig, Bin, DashboardSummary, Detection, Reading } from './types'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'simulator', label: 'IoT simulator', icon: Radio, group: 'WORKSPACE' },
  { id: 'bins', label: 'Bins', icon: Trash2, group: 'WORKSPACE' },
  { id: 'ai', label: 'AI waste detection', icon: ScanSearch, group: 'INTELLIGENCE' },
  { id: 'activity', label: 'Alerts & activity', icon: Bell, group: 'INTELLIGENCE' },
  { id: 'settings', label: 'Project settings', icon: Settings2, group: 'SYSTEM' },
]

type PageId = typeof NAV_ITEMS[number]['id']

function statusLabel(status: string) {
  if (status === 'almost_full') return 'Almost full'
  if (status === 'full') return 'Full'
  return 'Normal'
}
function timeAgo(value?: string) {
  if (!value) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
function BrandMark() {
  return <div className="brand-mark"><Leaf size={19} strokeWidth={2.5} /></div>
}

function Sidebar({ active, onNavigate, mobileOpen, onClose, unreadAlerts, environment }: { active: PageId; onNavigate: (page: PageId) => void; mobileOpen: boolean; onClose: () => void; unreadAlerts: number; environment: string }) {
  const groups = ['WORKSPACE', 'INTELLIGENCE', 'SYSTEM']
  return <>
    {mobileOpen && <button className="mobile-scrim" onClick={onClose} aria-label="Close menu" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row"><BrandMark /><div><div className="brand-name">ecomind<span>.</span></div><div className="brand-sub">WASTE INTELLIGENCE</div></div><button className="icon-button mobile-close" onClick={onClose}><X size={18} /></button></div>
      <nav className="side-nav">
        {groups.map(group => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{NAV_ITEMS.filter(item => item.group === group).map(item => {
          const Icon = item.icon
          return <button key={item.id} className={`nav-link ${active === item.id ? 'active' : ''}`} onClick={() => { onNavigate(item.id); onClose() }}><Icon size={18} /><span>{item.label}</span>{item.id === 'activity' && unreadAlerts > 0 && <span className="nav-count">{unreadAlerts}</span>}</button>
        })}</div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="pulse-dot" /><div><strong>Simulation environment</strong><span>{environment}</span></div></div></div>
    </aside>
  </>
}

function Topbar({ page, onMenu, backendOnline, unreadAlerts, onNavigate }: { page: PageId; onMenu: () => void; backendOnline: boolean; unreadAlerts: number; onNavigate: (page: PageId) => void }) {
  const item = NAV_ITEMS.find(n => n.id === page)
  return <header className="topbar"><div className="topbar-left"><button className="icon-button menu-trigger" onClick={onMenu}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{item?.label || 'Overview'}</strong></div></div><div className="topbar-right"><div className={`connection-pill ${backendOnline ? 'online' : 'offline'}`}><span className="pulse-dot" />{backendOnline ? 'Backend connected' : 'Backend offline'}</div><div className="topbar-divider" /><button className="icon-button top-notice" title="Notifications" aria-label={`Open alerts and activity, ${unreadAlerts} unread`} onClick={() => onNavigate('activity')}><Bell size={18} />{unreadAlerts > 0 && <span className="notification-count">{unreadAlerts}</span>}</button></div></header>
}

function StatCard({ label, value, suffix, note, icon: Icon, tone = 'green', onClick }: { label: string; value: string | number; suffix?: string; note: string; icon: typeof Activity; tone?: string; onClick: () => void }) {
  return <button type="button" className="stat-card stat-card-action" onClick={onClick}><span className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></span><span className="stat-value">{value}<small>{suffix}</small></span><span className="stat-foot"><span className="stat-note">{note}</span></span></button>
}

function FillBar({ value, thresholds }: { value: number; thresholds: AppConfig['thresholds'] }) {
  const tone = value >= thresholds.full ? 'red' : value >= thresholds.almost_full ? 'amber' : 'green'
  return <div className="fill-track"><div className={`fill-value ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

function SensorReadout({ bin }: { bin: Bin }) {
  return <div className="sensor-readout"><div className="readout-title"><div><span className="micro-label">ULTRASONIC SENSOR</span><strong>HC-SR04 · Virtual reading</strong></div><span className={`sensor-indicator ${bin.is_running ? "is-running" : "is-paused"}`}><i /> {bin.is_running ? "RUNNING" : "PAUSED"}</span></div><div className="readout-main"><div><span>Distance to waste</span><strong>{bin.distance_cm.toFixed(1)}<small>cm</small></strong></div><div className="readout-divider" /><div><span>Fill percentage</span><strong>{Math.round(bin.fill_percentage)}<small>%</small></strong></div></div><div className="readout-foot"><span><Activity size={13} /> Last update {timeAgo(bin.last_updated)}</span><span>Simulated sensor data</span></div></div>
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Activity; title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><p>{body}</p></div>
}

function MiniChart({ readings }: { readings: Reading[] }) {
  const values = readings.slice(-30)
  if (values.length < 2) return <div className="chart-empty">Run the simulator to build a live reading history.</div>
  const points = values.map((reading, index) => ({ x: 12 + (index / (values.length - 1)) * 376, y: 114 - (reading.fill_percentage / 100) * 94 }))
  const line = points.map(point => `${point.x},${point.y}`).join(' ')
  const area = `12,114 ${line} 388,114`
  return <svg className="history-chart" viewBox="0 0 400 130" preserveAspectRatio="none" aria-label="Garbage fill history chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2ba77a" stopOpacity=".22" /><stop offset="1" stopColor="#2ba77a" stopOpacity="0" /></linearGradient></defs>{[20,67,114].map(y => <line key={y} x1="12" x2="388" y1={y} y2={y} stroke="#e8eee9" strokeDasharray="4 5" />)}<polygon points={area} fill="url(#chartFill)" /><polyline points={line} fill="none" stroke="#25966c" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />{points.length > 0 && <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="#fff" stroke="#25966c" strokeWidth="2.5" />}</svg>
}

function OverviewPage({ summary, bins, alerts, readings, onNavigate, onNeedCollection, loading, config, backendOnline }: { summary: DashboardSummary | null; bins: Bin[]; alerts: AlertItem[]; readings: Reading[]; onNavigate: (page: PageId) => void; onNeedCollection: () => void; loading: boolean; config: AppConfig; backendOnline: boolean }) {
  return <>
    <PageIntro eyebrow="MONITORING OVERVIEW" title="Monitoring overview" description="A live view of your virtual waste network and system activity." action={<button className="button button-secondary" onClick={() => onNavigate('simulator')}><SlidersHorizontal size={16} /> Open simulator</button>} />
    <div className="stats-grid">
      <StatCard label="Virtual bins" value={summary?.total_bins ?? '—'} note="Current network" icon={Trash2} tone="green" onClick={() => onNavigate('bins')} />
      <StatCard label="Average fill level" value={summary?.average_fill ?? '—'} suffix="%" note="Network-wide capacity" icon={Gauge} tone="blue" onClick={() => onNavigate('simulator')} />
      <StatCard label="Bins need collection" value={summary?.full_bins ?? '—'} note={`At ${config.thresholds.full}% capacity or above`} icon={AlertOctagon} tone="amber" onClick={onNeedCollection} />
      <StatCard label="Unread alerts" value={summary?.unread_alerts ?? '—'} note="Requires attention" icon={Bell} tone="rose" onClick={() => onNavigate('activity')} />
    </div>
    <div className="content-grid overview-grid">
      <section className="panel bins-panel"><div className="panel-heading"><div><div className="panel-kicker">NETWORK STATUS</div><h2>Virtual bin network</h2></div><button className="text-button" onClick={() => onNavigate('simulator')}>View simulator <ArrowUpRight size={14} /></button></div>
        {loading && !bins.length ? <div className="panel-loading">Loading virtual bins…</div> : <div className="bin-list">{bins.map(bin => <div className="bin-row" key={bin.id}><div className="bin-row-icon"><Trash2 size={18} /></div><div className="bin-row-main"><div className="bin-row-title"><strong>{bin.name}</strong><span>{bin.id}</span></div><div className="bin-row-location">{bin.location}</div><FillBar value={bin.fill_percentage} thresholds={config.thresholds} /></div><div className="bin-row-meta"><strong>{Math.round(bin.fill_percentage)}%</strong><span className={`status-tag ${bin.status}`}>{statusLabel(bin.status)}</span></div></div>)}</div>}
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">LATEST EVENTS</div><h2>Recent alerts</h2></div><button className="icon-button subtle" onClick={() => onNavigate('activity')}><ArrowUpRight size={17} /></button></div>
        {!backendOnline ? <EmptyState icon={Bell} title="Backend offline" body="Alert history cannot be refreshed until the backend reconnects." /> : alerts.length === 0 ? <EmptyState icon={Bell} title="No alerts recorded" body="New alerts appear here after a configured threshold crossing or a saved AI detection." /> : <div className="activity-list">{alerts.slice(0, 4).map(alert => <button type="button" className="activity-row activity-row-action" key={alert.id} onClick={() => onNavigate('activity')}><div className={`activity-icon ${alert.severity}`}><AlertTriangle size={16} /></div><div className="activity-copy"><strong>{alert.title}</strong><p>{alert.message}</p><span>{timeAgo(alert.created_at)}</span></div></button>)}</div>}
      </section>
    </div>
    <div className="content-grid bottom-grid"><section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SIMULATED TELEMETRY</div><h2>Fill-level activity</h2></div><span className="chart-legend"><i /> Fill level</span></div><MiniChart readings={readings} /><div className="chart-axis"><span>Older readings</span><span>Latest</span></div></section><section className="panel system-panel"><div className="panel-heading"><div><div className="panel-kicker">SYSTEM HEALTH</div><h2>Simulation services</h2></div><span className={`healthy-label ${backendOnline ? "" : "offline"}`}><i /> {backendOnline ? "Connected" : "Offline"}</span></div><div className="service-row"><div className="service-icon"><Database size={16} /></div><div><strong>API & database</strong><span>FastAPI · SQLite</span></div><span className={`service-state ${backendOnline ? "" : "pending"}`}>{backendOnline ? "Online" : "Offline"}</span></div><div className="service-row"><div className="service-icon"><Radio size={16} /></div><div><strong>Virtual sensor engine</strong><span>{summary?.active_simulations ?? 0} active simulations</span></div><span className={`service-state ${backendOnline ? "" : "pending"}`}>{backendOnline ? "Ready" : "Offline"}</span></div><div className="service-row"><div className="service-icon"><Sparkles size={16} /></div><div><strong>AI model</strong><span>{config.ai.configured ? "Model configured" : "Model weights unavailable"}</span></div><span className={`service-state ${config.ai.configured ? "" : "pending"}`}>{config.ai.configured ? "Ready" : "Setup"}</span></div></section></div>
  </>
}

function SimulatorPage({ bins, onRefresh, config, initialBinId }: { bins: Bin[]; onRefresh: () => Promise<void>; config: AppConfig; initialBinId: string | null }) {
  const [selectedId, setSelectedId] = useState('')
  const [draftLevel, setDraftLevel] = useState(0)
  const [readings, setReadings] = useState<Reading[]>([])
  const [readingsError, setReadingsError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const selected = bins.find(bin => bin.id === selectedId) || bins[0]
  useEffect(() => { if (initialBinId && bins.some(bin => bin.id === initialBinId)) setSelectedId(initialBinId); else if (bins.length && !bins.some(bin => bin.id === selectedId)) setSelectedId(bins[0].id) }, [bins, selectedId, initialBinId])
  useEffect(() => { if (selected) setDraftLevel(Math.round(selected.fill_percentage)) }, [selected?.id, selected?.fill_percentage])
  const loadReadings = useCallback(async () => { if (selected) { try { setReadings(await api.readings(selected.id, config.simulation.max_readings)); setReadingsError('') } catch (cause) { setReadingsError(cause instanceof Error ? cause.message : 'Unable to load telemetry history') } } }, [selected?.id, config.simulation.max_readings])
  useEffect(() => { loadReadings() }, [loadReadings])
  useEffect(() => { const timer = window.setInterval(loadReadings, config.simulation.interval_seconds * 1000); return () => window.clearInterval(timer) }, [loadReadings, config.simulation.interval_seconds])
  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(''); setActionError('')
    try { await action(); await onRefresh(); await loadReadings(); setMessage(success) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Action failed') }
    finally { setBusy(false) }
  }
  if (!selected) return <EmptyState icon={Trash2} title="No virtual bins" body="The backend has not returned any simulated bins." />
  const isRunning = selected.is_running
  return <>
    <PageIntro eyebrow="VIRTUAL HARDWARE LAB" title="IoT simulator" description="Explore the virtual sensor, watch the bin fill, and control simulated telemetry." action={<div className="simulation-status"><span className={isRunning ? 'pulse-dot' : 'idle-dot'} />{isRunning ? 'Simulation running' : 'Simulation paused'}</div>} />
    <div className="sim-toolbar"><div className="select-wrap"><label htmlFor="bin-select">SELECT VIRTUAL BIN</label><div className="select-control"><Trash2 size={16} /><select id="bin-select" value={selected.id} onChange={event => setSelectedId(event.target.value)}>{bins.map(bin => <option key={bin.id} value={bin.id}>{bin.id} — {bin.name}</option>)}</select><ChevronDown size={15} /></div></div><div className="sim-toolbar-meta"><span><span className="pulse-dot" /> Data source: Python simulator</span><span>Update interval: {config.simulation.interval_seconds} sec</span></div></div>
    <div className="sim-layout">
      <section className="panel visualization-panel"><div className="panel-heading"><div><div className="panel-kicker">LIVE HARDWARE VISUALIZATION</div><h2>Inside the smart bin</h2></div><span className="tiny-chip">{selected.id}</span></div>
        <ImmersiveBinScene bin={selected} config={config} />
        <SensorReadout bin={selected} />
      </section>
      <div className="sim-side-column"><section className="panel control-panel"><div className="panel-heading"><div><div className="panel-kicker">MANUAL CONTROLS</div><h2>Simulation controls</h2></div><SlidersHorizontal size={18} className="muted-icon" /></div>
        <div className="level-control"><div><span>Garbage fill level</span><strong>{draftLevel}%</strong></div><input aria-label="Set garbage fill level" type="range" min="0" max="100" value={draftLevel} onChange={event => setDraftLevel(Number(event.target.value))} style={{ '--range-progress': `${draftLevel}%` } as CSSProperties} /><div className="range-labels"><span>Empty · 0%</span><span>Full · 100%</span></div><button className="button button-secondary apply-button" disabled={busy} onClick={() => runAction(() => api.setLevel(selected.id, draftLevel), 'Virtual sensor reading updated.')}><Check size={15} /> Apply level</button></div>
        <div className="control-actions"><button className={`button ${isRunning ? 'button-secondary' : 'button-primary'}`} disabled={busy} onClick={() => runAction(() => isRunning ? api.pause(selected.id) : api.start(selected.id), isRunning ? 'Simulation paused.' : 'Simulation started.')} >{isRunning ? <Pause size={16} /> : <Play size={16} />}{isRunning ? 'Pause' : 'Start simulation'}</button><button className="button button-ghost" disabled={busy} onClick={() => runAction(() => api.reset(selected.id), 'Bin emptied and simulation paused.')}><RefreshCw size={15} /> Empty bin</button></div>
        {message && <div className="inline-feedback"><Check size={14} />{message}</div>}
        {actionError && <div className="error-box">{actionError}</div>}
        <div className="control-note"><CircleHelp size={15} /><span>All readings are generated by software. No physical sensor or microcontroller is connected.</span></div>
      </section><DeviceTelemetryPanel bin={selected} config={config} /></div>
    </div>
    <section className="panel telemetry-panel"><div className="panel-heading"><div><div className="panel-kicker">RECENT SENSOR DATA</div><h2>Telemetry history</h2></div><span className="tiny-chip">Latest {readings.length} readings</span></div><div className="telemetry-table-wrap">{readingsError && <div className="error-box">{readingsError}</div>}<table className="data-table"><thead><tr><th>Timestamp</th><th>Distance</th><th>Fill level</th><th>Status</th><th>Source</th></tr></thead><tbody>{readings.slice().reverse().slice(0, 7).map(reading => <tr key={reading.id}><td>{new Date(reading.created_at).toLocaleString()}</td><td>{reading.distance_cm.toFixed(1)} cm</td><td><strong>{Math.round(reading.fill_percentage)}%</strong></td><td><span className={`status-tag ${reading.status}`}>{statusLabel(reading.status)}</span></td><td><span className="source-label"><Radio size={12} /> Simulated</span></td></tr>)}</tbody></table>{readings.length === 0 && <div className="chart-empty">No readings yet.</div>}</div></section>
  </>
}

function ActivityPage({ alerts, detections, onRefresh, backendOnline }: { alerts: AlertItem[]; detections: Detection[]; onRefresh: () => Promise<void>; backendOnline: boolean }) {
  const [tab, setTab] = useState<'alerts' | 'detections'>('alerts')
  const [actionError, setActionError] = useState('')
  const markRead = async (id: number) => {
    setActionError('')
    try { await api.readAlert(id); await onRefresh() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to mark alert as read') }
  }
  return <>
    <PageIntro eyebrow="SYSTEM ACTIVITY" title="Alerts & activity" description="Review capacity warnings, AI risk notifications and previous detection events." />
    <div className="tab-row"><button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>Alerts <span>{alerts.length}</span></button><button className={tab === 'detections' ? 'active' : ''} onClick={() => setTab('detections')}>AI detections <span>{detections.length}</span></button></div>
    <section className="panel full-table-panel">{actionError && <div className="error-box">{actionError}</div>}{!backendOnline ? <EmptyState icon={Bell} title="Backend offline" body="Alert and detection records cannot be refreshed until the backend reconnects." /> : tab === 'alerts' ? <><div className="panel-heading"><div><div className="panel-kicker">NOTIFICATION CENTER</div><h2>System alerts</h2></div><span className="tiny-chip">{alerts.filter(item => !item.is_read).length} unread</span></div>{alerts.length ? <div className="activity-list expanded">{alerts.map(alert => <div className={`activity-row ${alert.is_read ? 'read' : ''}`} key={alert.id}><div className={`activity-icon ${alert.severity}`}><AlertTriangle size={16} /></div><div className="activity-copy"><div className="activity-title-line"><strong>{alert.title}</strong><span className={`severity-label ${alert.severity}`}>{alert.severity}</span></div><p>{alert.message}</p><span>{alert.bin_name || 'System'} · {new Date(alert.created_at).toLocaleString()}</span></div>{!alert.is_read && <button className="button button-small button-ghost" onClick={() => markRead(alert.id)}><Check size={14} /> Mark read</button>}</div>)}</div> : <EmptyState icon={Bell} title="No alerts recorded" body="Capacity and AI risk alerts will appear here." />}</> : <><div className="panel-heading"><div><div className="panel-kicker">AI HISTORY</div><h2>Waste detections</h2></div><span className="tiny-chip">{detections.length} records</span></div>{detections.length ? <div className="telemetry-table-wrap"><table className="data-table"><thead><tr><th>Detected class</th><th>Confidence</th><th>Risk</th><th>Source image</th><th>Timestamp</th></tr></thead><tbody>{detections.map(detection => <tr key={detection.id}><td><strong>{detection.class_name.replace(/_/g, ' ')}</strong></td><td>{(detection.confidence * 100).toFixed(1)}%</td><td><span className={`risk-pill ${detection.risk_level}`}>{detection.risk_level.replace(/_/g, ' ')}</span></td><td>{detection.original_filename}</td><td>{new Date(detection.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState icon={ScanSearch} title="No AI detections yet" body="After a custom YOLO model is configured, analyzed images will be listed here." />}</>}</section>
  </>
}

function SettingsPage({ aiStatus, summary, config }: { aiStatus: AIStatus | null; summary: DashboardSummary | null; config: AppConfig }) {
  return <>
    <PageIntro eyebrow="CONFIGURATION" title="Project settings" description="Environment details and configuration for this local software simulation." />
    <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-kicker">APPLICATION</div><h2>Runtime configuration</h2></div><Settings2 size={18} className="muted-icon" /></div><div className="settings-list"><div><span>Deployment mode</span><strong>{config.app.environment}</strong></div><div><span>Simulation source</span><strong>Python virtual sensor</strong></div><div><span>Backend</span><strong>FastAPI REST API</strong></div><div><span>Database</span><strong>SQLite · Persistent</strong></div><div><span>Virtual bins</span><strong>{summary?.total_bins ?? '—'}</strong></div><div><span>Simulation interval</span><strong>{config.simulation.interval_seconds} seconds</strong></div></div></section><section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-kicker">ARTIFICIAL INTELLIGENCE</div><h2>YOLO model configuration</h2></div><Sparkles size={18} className="muted-icon" /></div><div className={`ai-config-card ${aiStatus?.configured ? 'ready' : ''}`}><div className="ai-config-icon"><Cpu size={22} /></div><div><strong>{aiStatus?.configured ? 'Model loaded' : 'Model not installed'}</strong><p>{aiStatus?.message || 'Checking model configuration…'}</p></div></div><div className="settings-list"><div><span>Architecture</span><strong>{config.ai.architecture}</strong></div><div><span>Target classes</span><strong>{config.ai.classes.length} waste categories</strong></div><div><span>Inference device</span><strong>{config.ai.device}</strong></div><div><span>Model weights</span><strong className="path-value">{config.ai.model_path}</strong></div></div><div className="settings-help">Follow <code>backend/ai/README.md</code> to prepare a dataset and train custom weights.</div></section></div>
    <div className="project-note"><div className="notice-icon"><CircleHelp size={19} /></div><div><strong>Simulation-only project</strong><p>No physical electronics are connected. Virtual readings are generated by the backend and stored as simulated telemetry. The AI module requires a genuinely trained model before it can return detections.</p></div></div>
  </>
}

export default function App() {
  const { config, loading: configLoading, error: configError } = useConfig()
  const [page, setPage] = useState<PageId>('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [bins, setBins] = useState<Bin[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [detections, setDetections] = useState<Detection[]>([])
  const [readings, setReadings] = useState<Reading[]>([])
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(new Date())
  const [backendError, setBackendError] = useState('')
  const [simulatorBinId, setSimulatorBinId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!config) return
    try {
      const [dashboardData, alertData, detectionData, aiData] = await Promise.all([
        api.dashboard(), api.alerts(), api.detections(), api.aiStatus(),
      ])
      setSummary(dashboardData); setBins(dashboardData.bins); setAlerts(alertData); setDetections(detectionData); setAIStatus(aiData); setBackendOnline(true); setBackendError(''); setLastSync(new Date())
      if (dashboardData.bins.length) {
        const preferred = dashboardData.bins.find(bin => bin.is_running) || dashboardData.bins[0]
        setReadings(await api.readings(preferred.id, config.simulation.max_readings))
      } else {
        setReadings([])
      }
    } catch (cause) {
      setBackendOnline(false)
      setBackendError(cause instanceof Error ? cause.message : 'Backend request failed')
    } finally { setLoading(false) }
  }, [config])

  useEffect(() => { if (!config) return; void refresh(); const timer = window.setInterval(() => void refresh(), config.simulation.interval_seconds * 1000); return () => window.clearInterval(timer) }, [refresh, config])

  if (!config) return <main className="config-gate"><strong>{configLoading ? "Loading application configuration…" : "Configuration unavailable"}</strong><p>{configError || "The backend did not return application configuration."}</p></main>

  return <div className="app-shell"><Sidebar active={page} onNavigate={setPage} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} unreadAlerts={backendOnline ? summary?.unread_alerts ?? 0 : 0} environment={config.app.environment} /><main className="main-shell"><Topbar page={page} onMenu={() => setMobileOpen(true)} backendOnline={backendOnline} unreadAlerts={backendOnline ? summary?.unread_alerts ?? 0 : 0} onNavigate={setPage} /><div className="main-content">
    {backendError && <div className="error-box backend-error">{backendError}</div>}
    {page === 'overview' && <OverviewPage summary={summary} bins={bins} alerts={alerts} readings={readings} onNavigate={setPage} onNeedCollection={() => { setSimulatorBinId(bins.find(bin => bin.status === 'full')?.id ?? null); setPage('simulator') }} loading={loading} config={config} backendOnline={backendOnline} />}
    {page === 'simulator' && <SimulatorPage bins={bins} onRefresh={refresh} config={config} initialBinId={simulatorBinId} />}
    {page === 'bins' && <BinsPage bins={bins} onRefresh={refresh} loading={loading} backendOnline={backendOnline} />}
    {page === 'ai' && <AIDetectionPage aiStatus={aiStatus} onRefresh={refresh} config={config} />}
    {page === 'activity' && <ActivityPage alerts={alerts} detections={detections} onRefresh={refresh} backendOnline={backendOnline} />}
    {page === 'settings' && <SettingsPage aiStatus={aiStatus} summary={summary} config={config} />}
    <footer className="app-footer"><span>© 2026 EcoMind Simulation</span><span><span className="footer-dot" /> Last sync {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>Built for intelligent waste research</span></footer>
  </div></main></div>
}
