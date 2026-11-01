import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Activity, AlertOctagon, AlertTriangle, ArrowUpRight, Bell, Camera, Check, ChevronDown,
  CircleHelp, Cpu, Database, FileImage, Gauge, LayoutDashboard, Leaf, Menu, MoreHorizontal,
  Pause, Play, Radio, RefreshCw, ScanSearch, Settings2, ShieldAlert, SlidersHorizontal,
  Sparkles, Trash2, Upload, X,
} from 'lucide-react'
import { api } from './api'
import { useConfig } from './ConfigContext'
import ImmersiveBinScene from './ImmersiveBinScene'
import DeviceTelemetryPanel from './components/DeviceTelemetryPanel'
import BinsPage from './pages/BinsPage'
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

function Sidebar({ active, onNavigate, mobileOpen, onClose }: { active: PageId; onNavigate: (page: PageId) => void; mobileOpen: boolean; onClose: () => void }) {
  const groups = ['WORKSPACE', 'INTELLIGENCE', 'SYSTEM']
  return <>
    {mobileOpen && <button className="mobile-scrim" onClick={onClose} aria-label="Close menu" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-row"><BrandMark /><div><div className="brand-name">ecomind<span>.</span></div><div className="brand-sub">WASTE INTELLIGENCE</div></div><button className="icon-button mobile-close" onClick={onClose}><X size={18} /></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">EW</div><div className="workspace-copy"><strong>EcoWaste Lab</strong><span>Simulation workspace</span></div><ChevronDown size={15} className="muted-icon" /></div>
      <nav className="side-nav">
        {groups.map(group => <div className="nav-group" key={group}><div className="nav-caption">{group}</div>{NAV_ITEMS.filter(item => item.group === group).map(item => {
          const Icon = item.icon
          return <button key={item.id} className={`nav-link ${active === item.id ? 'active' : ''}`} onClick={() => { onNavigate(item.id); onClose() }}><Icon size={18} /><span>{item.label}</span>{item.id === 'activity' && <span className="nav-dot" />}</button>
        })}</div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="pulse-dot" /><div><strong>Simulation environment</strong><span>Local instance</span></div></div><div className="profile-row"><div className="profile-avatar">K</div><div className="profile-copy"><strong>Project Admin</strong><span>Local administrator</span></div><MoreHorizontal size={18} className="muted-icon" /></div></div>
    </aside>
  </>
}

function Topbar({ page, onMenu, backendOnline }: { page: PageId; onMenu: () => void; backendOnline: boolean }) {
  const item = NAV_ITEMS.find(n => n.id === page)
  return <header className="topbar"><div className="topbar-left"><button className="icon-button menu-trigger" onClick={onMenu}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{item?.label || 'Overview'}</strong></div></div><div className="topbar-right"><div className={`connection-pill ${backendOnline ? 'online' : 'offline'}`}><span className="pulse-dot" />{backendOnline ? 'Backend connected' : 'Backend offline'}</div><div className="topbar-divider" /><button className="icon-button top-notice" title="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">KA</div></div></header>
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="intro-action">{action}</div>}</div>
}

function StatCard({ label, value, suffix, note, icon: Icon, tone = 'green', trend }: { label: string; value: string | number; suffix?: string; note: string; icon: typeof Activity; tone?: string; trend?: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}<small>{suffix}</small></div><div className="stat-foot"><span className="stat-note">{note}</span>{trend && <span className="trend-chip"><ArrowUpRight size={13} />{trend}</span>}</div></div>
}

function FillBar({ value, thresholds }: { value: number; thresholds: AppConfig['thresholds'] }) {
  const tone = value >= thresholds.full ? 'red' : value >= thresholds.almost_full ? 'amber' : 'green'
  return <div className="fill-track"><div className={`fill-value ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

function SensorReadout({ bin }: { bin: Bin }) {
  return <div className="sensor-readout"><div className="readout-title"><div><span className="micro-label">ULTRASONIC SENSOR</span><strong>HC-SR04 · Virtual reading</strong></div><span className="sensor-indicator"><i /> ACTIVE</span></div><div className="readout-main"><div><span>Distance to waste</span><strong>{bin.distance_cm.toFixed(1)}<small>cm</small></strong></div><div className="readout-divider" /><div><span>Fill percentage</span><strong>{Math.round(bin.fill_percentage)}<small>%</small></strong></div></div><div className="readout-foot"><span><Activity size={13} /> Last update {timeAgo(bin.last_updated)}</span><span>Simulated sensor data</span></div></div>
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

function OverviewPage({ summary, bins, alerts, readings, onNavigate, loading, config }: { summary: DashboardSummary | null; bins: Bin[]; alerts: AlertItem[]; readings: Reading[]; onNavigate: (page: PageId) => void; loading: boolean; config: AppConfig }) {
  return <>
    <PageIntro eyebrow="MONITORING OVERVIEW" title="Monitoring overview" description="A live view of your virtual waste network and system activity." action={<button className="button button-secondary" onClick={() => onNavigate('simulator')}><SlidersHorizontal size={16} /> Open simulator</button>} />
    <div className="stats-grid">
      <StatCard label="Virtual bins" value={summary?.total_bins ?? '—'} note="Current network" icon={Trash2} tone="green" />
      <StatCard label="Average fill level" value={summary?.average_fill ?? '—'} suffix="%" note="Network-wide capacity" icon={Gauge} tone="blue" />
      <StatCard label="Bins need collection" value={summary?.full_bins ?? '—'} note={`At ${config.thresholds.full}% capacity or above`} icon={AlertOctagon} tone="amber" />
      <StatCard label="Unread alerts" value={summary?.unread_alerts ?? '—'} note="Requires attention" icon={Bell} tone="rose" />
    </div>
    <div className="content-grid overview-grid">
      <section className="panel bins-panel"><div className="panel-heading"><div><div className="panel-kicker">NETWORK STATUS</div><h2>Virtual bin network</h2></div><button className="text-button" onClick={() => onNavigate('simulator')}>View simulator <ArrowUpRight size={14} /></button></div>
        {loading && !bins.length ? <div className="panel-loading">Loading virtual bins…</div> : <div className="bin-list">{bins.map(bin => <div className="bin-row" key={bin.id}><div className="bin-row-icon"><Trash2 size={18} /></div><div className="bin-row-main"><div className="bin-row-title"><strong>{bin.name}</strong><span>{bin.id}</span></div><div className="bin-row-location">{bin.location}</div><FillBar value={bin.fill_percentage} thresholds={config.thresholds} /></div><div className="bin-row-meta"><strong>{Math.round(bin.fill_percentage)}%</strong><span className={`status-tag ${bin.status}`}>{statusLabel(bin.status)}</span></div></div>)}</div>}
      </section>
      <section className="panel activity-panel"><div className="panel-heading"><div><div className="panel-kicker">LATEST EVENTS</div><h2>Recent alerts</h2></div><button className="icon-button subtle" onClick={() => onNavigate('activity')}><ArrowUpRight size={17} /></button></div>
        {alerts.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" body="New capacity and AI risk alerts will appear here." /> : <div className="activity-list">{alerts.slice(0, 4).map(alert => <div className="activity-row" key={alert.id}><div className={`activity-icon ${alert.severity}`}><AlertTriangle size={16} /></div><div className="activity-copy"><strong>{alert.title}</strong><p>{alert.message}</p><span>{timeAgo(alert.created_at)}</span></div></div>)}</div>}
      </section>
    </div>
    <div className="content-grid bottom-grid"><section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SIMULATED TELEMETRY</div><h2>Fill-level activity</h2></div><span className="chart-legend"><i /> Fill level</span></div><MiniChart readings={readings} /><div className="chart-axis"><span>Older readings</span><span>Latest</span></div></section><section className="panel system-panel"><div className="panel-heading"><div><div className="panel-kicker">SYSTEM HEALTH</div><h2>Simulation services</h2></div><span className="healthy-label"><i /> Operational</span></div><div className="service-row"><div className="service-icon"><Database size={16} /></div><div><strong>API & database</strong><span>FastAPI · SQLite</span></div><span className="service-state">Online</span></div><div className="service-row"><div className="service-icon"><Radio size={16} /></div><div><strong>Virtual sensor engine</strong><span>{summary?.active_simulations ?? 0} active simulations</span></div><span className="service-state">Ready</span></div><div className="service-row"><div className="service-icon"><Sparkles size={16} /></div><div><strong>AI model</strong><span>Custom YOLO weights required</span></div><span className="service-state pending">Setup</span></div></section></div>
  </>
}

function SimulatorPage({ bins, onRefresh, config }: { bins: Bin[]; onRefresh: () => Promise<void>; config: AppConfig }) {
  const [selectedId, setSelectedId] = useState('')
  const [draftLevel, setDraftLevel] = useState(0)
  const [readings, setReadings] = useState<Reading[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selected = bins.find(bin => bin.id === selectedId) || bins[0]
  useEffect(() => { if (bins.length && !bins.some(bin => bin.id === selectedId)) setSelectedId(bins[0].id) }, [bins, selectedId])
  useEffect(() => { if (selected) setDraftLevel(Math.round(selected.fill_percentage)) }, [selected?.id, selected?.fill_percentage])
  const loadReadings = useCallback(async () => { if (selected) { try { setReadings(await api.readings(selected.id, config.simulation.max_readings)) } catch { /* main connection state is handled by app */ } } }, [selected?.id, config.simulation.max_readings])
  useEffect(() => { loadReadings() }, [loadReadings])
  useEffect(() => { const timer = window.setInterval(loadReadings, config.simulation.interval_seconds * 1000); return () => window.clearInterval(timer) }, [loadReadings, config.simulation.interval_seconds])
  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage('')
    try { await action(); await onRefresh(); await loadReadings(); setMessage(success) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed') }
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
        <div className="control-note"><CircleHelp size={15} /><span>All readings are generated by software. No physical sensor or microcontroller is connected.</span></div>
      </section><DeviceTelemetryPanel bin={selected} config={config} /></div>
    </div>
    <section className="panel telemetry-panel"><div className="panel-heading"><div><div className="panel-kicker">RECENT SENSOR DATA</div><h2>Telemetry history</h2></div><span className="tiny-chip">Latest {readings.length} readings</span></div><div className="telemetry-table-wrap"><table className="data-table"><thead><tr><th>Timestamp</th><th>Distance</th><th>Fill level</th><th>Status</th><th>Source</th></tr></thead><tbody>{readings.slice().reverse().slice(0, 7).map(reading => <tr key={reading.id}><td>{new Date(reading.created_at).toLocaleString()}</td><td>{reading.distance_cm.toFixed(1)} cm</td><td><strong>{Math.round(reading.fill_percentage)}%</strong></td><td><span className={`status-tag ${reading.status}`}>{statusLabel(reading.status)}</span></td><td><span className="source-label"><Radio size={12} /> Simulated</span></td></tr>)}</tbody></table>{readings.length === 0 && <div className="chart-empty">No readings yet.</div>}</div></section>
  </>
}

function AIDetectionPage({ aiStatus, onRefresh, config }: { aiStatus: AIStatus | null; onRefresh: () => Promise<void>; config: AppConfig }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ message: string; detections: Detection[] } | null>(null)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isModelReady = Boolean(aiStatus?.configured)

  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()) }, [])
  const selectFile = (next: File | undefined) => {
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPG, PNG or WEBP image.'); return }
    if (next.size > 10 * 1024 * 1024) { setError('The image must be smaller than 10 MB.'); return }
    setFile(next); setPreview(URL.createObjectURL(next)); setResult(null); setError('')
  }
  const openCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream; setCameraOpen(true)
      window.setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play() } }, 80)
    } catch { setError('Camera access is unavailable. Use image upload instead, or allow camera permission in your browser.') }
  }
  const closeCamera = () => { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOpen(false) }
  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => { if (blob) selectFile(new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); closeCamera() }, 'image/jpeg', 0.92)
  }
  const analyze = async () => {
    if (!file) return
    setBusy(true); setError(''); setResult(null)
    try { const response = await api.detect(file); setResult({ message: response.message, detections: response.detections }); await onRefresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Image analysis failed') }
    finally { setBusy(false) }
  }
  return <>
    <PageIntro eyebrow="ARTIFICIAL INTELLIGENCE" title="Waste detection" description="Analyze waste imagery with a custom object-detection model and review risk signals." action={<div className={`model-state ${isModelReady ? 'ready' : 'not-ready'}`}><span />{isModelReady ? 'YOLO model ready' : 'Model setup required'}</div>} />
    {!isModelReady && <div className="notice-banner"><div className="notice-icon"><Sparkles size={19} /></div><div><strong>AI model is not configured yet</strong><p>{aiStatus?.message || 'Train a custom YOLO model and add its best.pt weights to backend/ai/weights/.'} The application will not generate placeholder predictions.</p></div><span className="notice-tag">SETUP</span></div>}
    <div className="ai-layout"><section className="panel upload-panel"><div className="panel-heading"><div><div className="panel-kicker">IMAGE ACQUISITION</div><h2>Upload waste image</h2></div><span className="tiny-chip">Max 10 MB</span></div>
      {cameraOpen ? <div className="camera-view"><video ref={videoRef} playsInline muted /><div className="camera-actions"><button className="button button-primary" onClick={captureFrame}><Camera size={16} /> Capture image</button><button className="button button-ghost" onClick={closeCamera}>Cancel</button></div></div> : <>
        <button className={`dropzone ${preview ? 'has-preview' : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}>
          {preview ? <><img src={preview} alt="Selected waste item" /><span className="preview-overlay"><FileImage size={17} /> Replace image</span></> : <><div className="upload-icon"><Upload size={22} /></div><strong>Drop an image here, or browse</strong><span>JPG, PNG or WEBP · Up to 10 MB</span></>}
        </button>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectFile(event.target.files?.[0])} />
        <div className="upload-actions"><button className="button button-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Browse files</button><button className="button button-ghost" onClick={openCamera}><Camera size={15} /> Use camera</button></div>
      </>}
      {error && <div className="error-box"><AlertTriangle size={15} />{error}</div>}
      {preview && !cameraOpen && <div className="selected-file"><FileImage size={16} /><div><strong>{file?.name}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</span></div><button className="icon-button" onClick={() => { setFile(null); setPreview(''); setResult(null) }}><X size={16} /></button></div>}
      <button className="button button-primary analyze-button" disabled={!file || !isModelReady || busy} onClick={analyze}>{busy ? <><RefreshCw size={16} className="spin" /> Analyzing image…</> : <><ScanSearch size={16} /> Analyze waste image</>}</button>
      {!isModelReady && <p className="disabled-hint">Image analysis becomes available after a trained YOLO model is installed.</p>}
    </section>
    <section className="panel result-panel"><div className="panel-heading"><div><div className="panel-kicker">MODEL OUTPUT</div><h2>Detection results</h2></div><span className="tiny-chip">{config.ai.classes.length} target classes</span></div>
      {!result ? <div className="result-placeholder"><div className="scan-illustration"><ScanSearch size={36} /><span /><i /></div><strong>Waiting for an image</strong><p>Upload a waste image and run the trained model to see detected objects, confidence scores and risk levels.</p><div className="class-chips">{config.ai.classes.map(className => <span key={className}>{className.replace(/_/g, " ")}</span>)}</div></div> : <div className="result-content"><div className="result-summary"><div><span>Objects detected</span><strong>{result.detections.length}</strong></div><div><span>Model response</span><strong>{result.message}</strong></div></div>{result.detections.length ? result.detections.map(item => <div className="detection-result" key={item.id}><div><strong>{item.class_name.replace(/_/g, ' ')}</strong><span>{(item.confidence * 100).toFixed(1)}% confidence</span></div><span className={`risk-pill ${item.risk_level}`}>{item.risk_level.replace(/_/g, ' ')}</span></div>) : <div className="empty-inline">No target objects detected in this image.</div>}</div>}
      <div className="model-classes"><div className="micro-label">MODEL CLASSES</div><div className="class-grid">{config.ai.classes.map(className => <span key={className}>{className.replace(/_/g, " ")}</span>)}</div></div>
    </section></div>
    <div className="ai-disclaimer"><ShieldAlert size={16} /><span>Visual AI screening is not a chemical or biological hazard test. Low-confidence, unknown, or safety-critical items require human review.</span></div>
  </>
}

function ActivityPage({ alerts, detections, onRefresh }: { alerts: AlertItem[]; detections: Detection[]; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState<'alerts' | 'detections'>('alerts')
  const markRead = async (id: number) => { try { await api.readAlert(id); await onRefresh() } catch { /* surfaced by refresh connection state */ } }
  return <>
    <PageIntro eyebrow="SYSTEM ACTIVITY" title="Alerts & activity" description="Review capacity warnings, AI risk notifications and previous detection events." />
    <div className="tab-row"><button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>Alerts <span>{alerts.length}</span></button><button className={tab === 'detections' ? 'active' : ''} onClick={() => setTab('detections')}>AI detections <span>{detections.length}</span></button></div>
    <section className="panel full-table-panel">{tab === 'alerts' ? <><div className="panel-heading"><div><div className="panel-kicker">NOTIFICATION CENTER</div><h2>System alerts</h2></div><span className="tiny-chip">{alerts.filter(item => !item.is_read).length} unread</span></div>{alerts.length ? <div className="activity-list expanded">{alerts.map(alert => <div className={`activity-row ${alert.is_read ? 'read' : ''}`} key={alert.id}><div className={`activity-icon ${alert.severity}`}><AlertTriangle size={16} /></div><div className="activity-copy"><div className="activity-title-line"><strong>{alert.title}</strong><span className={`severity-label ${alert.severity}`}>{alert.severity}</span></div><p>{alert.message}</p><span>{alert.bin_name || 'System'} · {new Date(alert.created_at).toLocaleString()}</span></div>{!alert.is_read && <button className="button button-small button-ghost" onClick={() => markRead(alert.id)}><Check size={14} /> Mark read</button>}</div>)}</div> : <EmptyState icon={Bell} title="No alerts recorded" body="Capacity and AI risk alerts will appear here." />}</> : <><div className="panel-heading"><div><div className="panel-kicker">AI HISTORY</div><h2>Waste detections</h2></div><span className="tiny-chip">{detections.length} records</span></div>{detections.length ? <div className="telemetry-table-wrap"><table className="data-table"><thead><tr><th>Detected class</th><th>Confidence</th><th>Risk</th><th>Source image</th><th>Timestamp</th></tr></thead><tbody>{detections.map(detection => <tr key={detection.id}><td><strong>{detection.class_name.replace(/_/g, ' ')}</strong></td><td>{(detection.confidence * 100).toFixed(1)}%</td><td><span className={`risk-pill ${detection.risk_level}`}>{detection.risk_level.replace(/_/g, ' ')}</span></td><td>{detection.original_filename}</td><td>{new Date(detection.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState icon={ScanSearch} title="No AI detections yet" body="After a custom YOLO model is configured, analyzed images will be listed here." />}</>}</section>
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

  const refresh = useCallback(async () => {
    try {
      const [dashboardData, alertData, detectionData, aiData] = await Promise.all([
        api.dashboard(), api.alerts(), api.detections(), api.aiStatus(),
      ])
      setSummary(dashboardData); setBins(dashboardData.bins); setAlerts(alertData); setDetections(detectionData); setAIStatus(aiData); setBackendOnline(true); setBackendError(''); setLastSync(new Date())
      if (dashboardData.bins.length) {
        const preferred = dashboardData.bins.find(bin => bin.is_running) || dashboardData.bins[0]
        try { setReadings(await api.readings(preferred.id, config?.simulation.max_readings || 48)) } catch { /* next poll retries */ }
      }
    } catch (cause) {
      setBackendOnline(false)
      setBackendError(cause instanceof Error ? cause.message : 'Backend request failed')
    } finally { setLoading(false) }
  }, [config?.simulation.max_readings])

  useEffect(() => { if (!config) return; void refresh(); const timer = window.setInterval(() => void refresh(), config.simulation.interval_seconds * 1000); return () => window.clearInterval(timer) }, [refresh, config])

  if (!config) return <main className="config-gate"><strong>{configLoading ? "Loading application configuration…" : "Configuration unavailable"}</strong><p>{configError || "The backend did not return application configuration."}</p></main>

  return <div className="app-shell"><Sidebar active={page} onNavigate={setPage} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><main className="main-shell"><Topbar page={page} onMenu={() => setMobileOpen(true)} backendOnline={backendOnline} /><div className="main-content">
    {backendError && <div className="error-box backend-error">{backendError}</div>}
    {page === 'overview' && <OverviewPage summary={summary} bins={bins} alerts={alerts} readings={readings} onNavigate={setPage} loading={loading} config={config} />}
    {page === 'simulator' && <SimulatorPage bins={bins} onRefresh={refresh} config={config} />}
    {page === 'bins' && <BinsPage bins={bins} onRefresh={refresh} />}
    {page === 'ai' && <AIDetectionPage aiStatus={aiStatus} onRefresh={refresh} config={config} />}
    {page === 'activity' && <ActivityPage alerts={alerts} detections={detections} onRefresh={refresh} />}
    {page === 'settings' && <SettingsPage aiStatus={aiStatus} summary={summary} config={config} />}
    <footer className="app-footer"><span>© 2026 EcoMind Simulation</span><span><span className="footer-dot" /> Last sync {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>Built for intelligent waste research</span></footer>
  </div></main></div>
}
