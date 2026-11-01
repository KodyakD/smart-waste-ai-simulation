import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Camera, FileImage, RefreshCw, ScanSearch, ShieldAlert, Sparkles, Upload, X,
} from 'lucide-react'
import { api } from '../api'
import PageIntro from '../components/PageIntro'
import type { AIStatus, AppConfig, Detection } from '../types'

export default function AIDetectionPage({ aiStatus, onRefresh, config }: { aiStatus: AIStatus | null; onRefresh: () => Promise<void>; config: AppConfig }) {
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
    <section className="panel result-panel"><div className="panel-heading"><div><div className="panel-kicker">MODEL OUTPUT</div><h2>Detection results</h2></div><span className="tiny-chip">{config.ai.supported_classes.length} supported · {config.ai.unsupported_classes.length} unsupported</span></div>
      {!result ? <div className="result-placeholder"><div className="scan-illustration"><ScanSearch size={36} /><span /><i /></div><strong>Waiting for an image</strong><p>Upload a waste image and run the trained model to see detected objects, confidence scores and risk levels.</p><div className="class-chips">{config.ai.classes.map(className => { const supported = config.ai.supported_classes.includes(className); return <span key={className} className={supported ? "class-supported" : "class-unsupported"}>{className.replace(/_/g, " ")} · {supported ? "supported" : "unsupported"}</span> })}</div></div> : <div className="result-content"><div className="result-summary"><div><span>Objects detected</span><strong>{result.detections.length}</strong></div><div><span>Model response</span><strong>{result.message}</strong></div></div>{result.detections.length ? result.detections.map(item => <div className="detection-result" key={item.id}><div><strong>{item.class_name.replace(/_/g, ' ')}</strong><span>{(item.confidence * 100).toFixed(1)}% confidence</span></div><span className={`risk-pill ${item.risk_level}`}>{item.risk_level.replace(/_/g, ' ')}</span></div>) : <div className="empty-inline">No target objects detected in this image.</div>}</div>}
      <div className="model-classes"><div className="micro-label">MODEL CLASSES AND DATA COVERAGE</div><div className="class-grid">{config.ai.classes.map(className => { const supported = config.ai.supported_classes.includes(className); return <span key={className} className={supported ? "class-supported" : "class-unsupported"}>{className.replace(/_/g, " ")} · {supported ? "supported" : "unsupported"}</span> })}</div>{config.ai.unsupported_classes.length > 0 && <p className="disabled-hint">The current licensed dataset has no training labels for: {config.ai.unsupported_classes.map(name => name.replace(/_/g, " ")).join(", ")}.</p>}</div>
    </section></div>
    <div className="ai-disclaimer"><ShieldAlert size={16} /><span>Visual AI screening is not a chemical or biological hazard test. Low-confidence, unknown, or safety-critical items require human review.</span></div>
  </>
}
