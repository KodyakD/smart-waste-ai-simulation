import { Radio } from 'lucide-react'
import type { AppConfig, Bin } from './types'
import './immersive-scene.css'

type Props = {
  bin: Bin
  config: AppConfig
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function ImmersiveBinScene({ bin, config }: Props) {
  const fill = clamp(bin.fill_percentage, 0, 100)
  const surfaceY = 383 - (fill / 100) * 213
  const distance = Math.max(0, bin.distance_cm)
  const safeId = bin.id.replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = 'waste-front-' + safeId
  const sideClipId = 'waste-side-' + safeId
  const status = fill >= config.thresholds.full ? 'Full capacity' : fill >= config.thresholds.almost_full ? 'Collection soon' : 'Normal operation'
  const tone = fill >= config.thresholds.full ? 'critical' : fill >= config.thresholds.almost_full ? 'warning' : 'healthy'

  return (
    <section className={'immersive-scene ' + (bin.is_running ? 'scene-running' : 'scene-paused')} aria-label="Interactive virtual garbage bin hardware visualization">
      <div className="scene-grid" />
      <div className="scene-glow scene-glow-one" />
      <div className="scene-glow scene-glow-two" />

      <div className="scene-topline">
        <div className="scene-topline-left">
          <span className="scene-live-indicator"><i /> {bin.is_running ? 'LIVE SIMULATION' : 'SIMULATION PAUSED'}</span>
          <span className="scene-separator">/</span>
          <span className="scene-device-name">ULTRASONIC LEVEL MONITOR</span>
        </div>
        <span className="scene-bin-id">{bin.id} <span>•</span> VIRTUAL DEVICE</span>
      </div>

      <div className="scene-main">
        <div className="scene-canvas">
          <div className="scene-side-caption scene-caption-sensor">
            <span className="scene-caption-icon">01</span>
            <span><strong>Ultrasonic module</strong><small>HC-SR04 · top mounted</small></span>
          </div>
          <div className="scene-side-caption scene-caption-waste">
            <span className="scene-caption-icon">02</span>
            <span><strong>Waste surface</strong><small>{Math.round(fill)}% of usable capacity</small></span>
          </div>

          <svg className="scene-bin-svg" viewBox="0 0 620 460" role="img" aria-label={'Transparent virtual garbage bin, ' + Math.round(fill) + ' percent full, sensor distance ' + distance.toFixed(1) + ' centimetres'}>
            <defs>
              <linearGradient id={'bin-front-' + safeId} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#b6d9ca" stopOpacity=".12" />
                <stop offset=".48" stopColor="#e6fff1" stopOpacity=".13" />
                <stop offset="1" stopColor="#9abdae" stopOpacity=".08" />
              </linearGradient>
              <linearGradient id={'bin-side-' + safeId} x1="0" x2="1">
                <stop offset="0" stopColor="#9fc7b5" stopOpacity=".2" />
                <stop offset="1" stopColor="#6f9d88" stopOpacity=".08" />
              </linearGradient>
              <linearGradient id={'waste-fill-' + safeId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#d4a46d" />
                <stop offset=".55" stopColor="#a8794f" />
                <stop offset="1" stopColor="#76573e" />
              </linearGradient>
              <linearGradient id={'waste-side-fill-' + safeId} x1="0" x2="1">
                <stop offset="0" stopColor="#a67a53" />
                <stop offset="1" stopColor="#70543d" />
              </linearGradient>
              <linearGradient id={'sensor-metal-' + safeId} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#8ce8bd" />
                <stop offset=".5" stopColor="#3da77f" />
                <stop offset="1" stopColor="#236c55" />
              </linearGradient>
              <clipPath id={clipId}>
                <path d="M190 151 L393 151 L373 382 L210 382 Z" />
              </clipPath>
              <clipPath id={sideClipId}>
                <path d="M393 151 L453 179 L431 410 L373 382 Z" />
              </clipPath>
              <filter id={'soft-shadow-' + safeId} x="-30%" y="-30%" width="160%" height="180%">
                <feGaussianBlur stdDeviation="12" />
              </filter>
            </defs>

            <ellipse cx="315" cy="414" rx="178" ry="19" fill="#000" opacity=".23" filter={'url(#soft-shadow-' + safeId + ')'} />
            <ellipse cx="315" cy="414" rx="151" ry="12" fill="#07110f" opacity=".45" />

            {/* Floor markings and height scale */}
            <path d="M82 399 H520 M112 409 H488" stroke="#527568" strokeOpacity=".2" strokeDasharray="3 8" />
            <g className="scene-height-scale">
              <path d="M493 170 V383" stroke="#9ac7b2" strokeOpacity=".55" strokeWidth="1.2" />
              {[0, 25, 50, 75, 100].map((tick) => {
                const y = 383 - tick * 2.13
                return <g key={tick}>
                  <path d={'M486 ' + y + ' H500'} stroke="#9ac7b2" strokeOpacity=".7" />
                  <text x="508" y={y + 3} fill="#8fb5a3" fontSize="10">{tick}%</text>
                </g>
              })}
            </g>

            {/* Ultrasonic return path */}
            <path className="scene-sonar-beam" d={'M321 112 V' + (surfaceY - 9)} />
            <path className="scene-sonar-return" d={'M328 ' + (surfaceY - 6) + ' H425'} />
            <g className="scene-sonar-rings" transform={'translate(321 ' + (surfaceY - 4) + ')'}>
              <path d="M-15 0 Q0 -11 15 0" />
              <path d="M-24 0 Q0 -20 24 0" />
              <path d="M-34 0 Q0 -29 34 0" />
            </g>
            <circle cx="321" cy={surfaceY} r="4.5" fill="#79e4b2" className="scene-impact-dot" />

            {/* Sensor bracket */}
            <path d="M280 103 V126 M362 103 V126 M271 126 H371" stroke="#6ca58b" strokeWidth="5" strokeLinecap="round" opacity=".75" />
            <rect x="258" y="69" width="126" height="43" rx="8" fill="#17392f" stroke="#5fc99a" strokeWidth="1.5" />
            <rect x="266" y="76" width="110" height="29" rx="5" fill="#214d3e" />
            <circle cx="290" cy="91" r="13" fill="#10271f" stroke={'url(#sensor-metal-' + safeId + ')'} strokeWidth="3" />
            <circle cx="290" cy="91" r="8" fill="#091914" stroke="#7ce3b4" strokeOpacity=".7" />
            <circle cx="352" cy="91" r="13" fill="#10271f" stroke="#56bb8d" strokeWidth="3" />
            <circle cx="352" cy="91" r="8" fill="#091914" stroke="#7ce3b4" strokeOpacity=".7" />
            <circle cx="321" cy="112" r="2.5" fill="#9af3c7" />

            {/* Bin lid and rear rim */}
            <path d="M171 145 Q303 119 413 145 L472 169 Q332 201 223 176 Z" fill="#183c30" stroke="#75a78e" strokeWidth="2" />
            <path d="M188 145 Q304 125 401 145 L453 165 Q330 190 237 171 Z" fill="#294f41" stroke="#8bbca4" strokeOpacity=".55" />
            <path d="M197 148 Q303 133 395 148" fill="none" stroke="#b4e4ca" strokeOpacity=".35" strokeWidth="2" />

            {/* Waste volume */}
            {fill > 0 && <>
              <g clipPath={'url(#' + sideClipId + ')'}>
                <path d={'M393 ' + (surfaceY + 1) + ' L453 ' + (surfaceY + 28) + ' L431 410 L373 382 Z'} fill={'url(#waste-side-fill-' + safeId + ')'} />
              </g>
              <g clipPath={'url(#' + clipId + ')'}>
                <path d={'M190 ' + surfaceY + ' Q224 ' + (surfaceY - 10) + ' 260 ' + (surfaceY + 1) + ' T330 ' + surfaceY + ' T393 ' + (surfaceY + 2) + ' L373 382 L210 382 Z'} fill={'url(#waste-fill-' + safeId + ')'} />
                <path d={'M190 ' + surfaceY + ' Q224 ' + (surfaceY - 10) + ' 260 ' + (surfaceY + 1) + ' T330 ' + surfaceY + ' T393 ' + (surfaceY + 2)} fill="none" stroke="#e8bd88" strokeWidth="3" strokeOpacity=".85" />
                <g opacity=".9">
                  <path d={'M228 ' + (surfaceY + 24) + ' l33 -7 12 17 -31 13 Z'} fill="#e5c69b" stroke="#8b6748" strokeWidth="1.2" />
                  <path d={'M280 ' + (surfaceY + 36) + ' q12 -8 24 0 l-4 23 q-12 8 -24 -1 Z'} fill="#4a92a1" stroke="#9bd0d4" strokeWidth="1.5" />
                  <path d={'M286 ' + (surfaceY + 34) + ' h12 v-5 h-12 Z'} fill="#d9e7e0" />
                  <rect x="329" y={surfaceY + 20} width="23" height="36" rx="5" fill="#d9a94b" stroke="#7f6839" strokeWidth="1.2" transform={'rotate(18 340 ' + (surfaceY + 38) + ')'} />
                  <path d={'M333 ' + (surfaceY + 31) + ' h15'} stroke="#fff0c0" strokeWidth="2" transform={'rotate(18 340 ' + (surfaceY + 38) + ')'} />
                  <path d={'M238 ' + (surfaceY + 73) + ' l31 -9 11 12 -26 16 Z'} fill="#7d6d55" stroke="#c7b38e" strokeWidth="1" />
                  <path d={'M298 ' + (surfaceY + 82) + ' q16 -14 28 -1 l-3 11 -29 2 Z'} fill="#c7d2c8" stroke="#758d7e" strokeWidth="1" />
                  <circle cx="364" cy={surfaceY + 79} r="10" fill="#d8b47d" stroke="#8e6d47" />
                </g>
                <g opacity=".22" fill="#fff">
                  <path d="M206 314 l36 -9 9 5 -34 11 Z" />
                  <path d="M310 350 l41 -8 10 4 -40 10 Z" />
                </g>
              </g>
            </>}

            {/* Transparent front and right side shell */}
            <path d="M393 151 L453 179 L431 410 L373 382 Z" fill={'url(#bin-side-' + safeId + ')'} stroke="#86b9a1" strokeWidth="2.2" />
            <path d="M190 151 L393 151 L373 382 L210 382 Z" fill={'url(#bin-front-' + safeId + ')'} stroke="#a4d1bc" strokeWidth="2.4" />
            <path d="M191 152 L210 382 M392 153 L373 382" stroke="#d3f4df" strokeOpacity=".28" strokeWidth="5" />
            <path d="M216 169 L228 354 M379 169 L364 354" stroke="#b8e5cc" strokeOpacity=".2" strokeWidth="2" />
            <path d="M199 194 H385 M196 266 H379 M190 337 H373" stroke="#b4ddc6" strokeOpacity=".14" strokeDasharray="3 7" />
            <path d="M210 382 L373 382 L431 410" fill="none" stroke="#a3d3ba" strokeWidth="2.5" />
            <path d="M220 391 L220 402 M362 391 L362 402 M420 398 L420 407" stroke="#67947e" strokeWidth="7" strokeLinecap="round" />

            {/* Front access panel */}
            <path d="M258 185 L328 185 L322 202 L256 202 Z" fill="#e0f6e8" fillOpacity=".08" stroke="#a7d5bd" strokeOpacity=".4" />
            <path d="M272 194 H311" stroke="#a3d7ba" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
            <circle cx="305" cy="194" r="2" fill="#a3d7ba" />

            {/* Small indicator on the bin */}
            <circle cx="342" cy="215" r="5" fill={tone === 'critical' ? '#ff836f' : tone === 'warning' ? '#f2c46e' : '#70e2a8'} className="scene-bin-led" />
            <circle cx="342" cy="215" r="10" fill={tone === 'critical' ? '#ff836f' : tone === 'warning' ? '#f2c46e' : '#70e2a8'} opacity=".12" />

            {/* Distance label */}
            <g className="scene-distance-tag" transform="translate(408 244)">
              <rect width="105" height="38" rx="8" fill="#112d24" stroke="#4d8b70" />
              <text x="12" y="14" fill="#8bbba2" fontSize="8" fontWeight="700" letterSpacing="1">ECHO DISTANCE</text>
              <text x="12" y="29" fill="#e8fff1" fontSize="13" fontWeight="800">{distance.toFixed(1)} cm</text>
            </g>
          </svg>

          <div className="scene-axis-label scene-axis-top">EMPTY <span>{bin.capacity_cm.toFixed(1)} cm</span></div>
          <div className="scene-axis-label scene-axis-bottom">FULL <span>{config.simulation.full_distance_cm.toFixed(1)} cm</span></div>
        </div>

        <aside className="scene-instrument-panel">
          <div className="scene-instrument-heading">
            <span>LIVE TELEMETRY</span>
            <span className={bin.is_running ? 'instrument-live' : 'instrument-paused'}><i /> {bin.is_running ? 'STREAMING' : 'PAUSED'}</span>
          </div>

          <div className="scene-fill-card">
            <div className="scene-fill-copy">
              <span>BIN CAPACITY</span>
              <strong>{Math.round(fill)}<small>%</small></strong>
              <em className={'scene-status ' + tone}>{status}</em>
            </div>
            <div className="scene-ring" style={{ background: 'conic-gradient(#70dca5 ' + fill + '%, rgba(140,190,164,.13) 0)' }}>
              <div><strong>{Math.round(fill)}%</strong><small>filled</small></div>
            </div>
          </div>

          <div className="scene-meter">
            <div className="scene-meter-label"><span>Sensor distance</span><strong>{distance.toFixed(1)} <small>cm</small></strong></div>
            <div className="scene-distance-meter"><span style={{ width: clamp((distance / bin.capacity_cm) * 100, 0, 100) + '%' }} /></div>
            <div className="scene-meter-hints"><span>Near</span><span>Far</span></div>
          </div>

          <div className="scene-signal-card">
            <div className="scene-signal-icon"><Radio size={16} /></div>
            <div><strong>Ultrasonic echo</strong><span>Round-trip time estimate</span></div>
            <span className="scene-signal-value">{((2 * distance) / config.simulation.speed_of_sound_cm_per_us).toFixed(0)} <small>µs</small></span>
          </div>

        </aside>
      </div>

      <div className="scene-bottomline">
        <div className="scene-legend">
          <span><i className="legend-pulse" /> Sonar pulse</span>
          <span><i className="legend-surface" /> Waste surface</span>
          <span><i className="legend-shell" /> Transparent bin shell</span>
        </div>
        <div className={'scene-capacity-note ' + tone}><span /> {status}</div>
      </div>
    </section>
  )
}
