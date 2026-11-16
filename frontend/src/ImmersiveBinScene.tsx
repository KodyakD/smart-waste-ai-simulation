import type { AppConfig, Bin } from './types'
import './immersive-scene.css'

type Props = {
  bin: Bin
  config: AppConfig
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/* Section drawing of a virtual bin. Every number is read from the backend:
   capacity and echo distance from the bin, thresholds from the runtime config. */
export default function ImmersiveBinScene({ bin, config }: Props) {
  const fill = clamp(bin.fill_percentage, 0, 100)
  const distance = Math.max(0, bin.distance_cm)
  const rimY = 175
  const floorY = 470
  const surfaceY = floorY - (fill / 100) * (floorY - rimY + 20)
  const echoMicroseconds = (2 * distance) / config.simulation.speed_of_sound_cm_per_us
  const safeId = bin.id.replace(/[^a-zA-Z0-9_-]/g, '')
  const status = fill >= config.thresholds.full ? 'Full capacity' : fill >= config.thresholds.almost_full ? 'Collection due' : 'Normal operation'
  const tone = fill >= config.thresholds.full ? 'critical' : fill >= config.thresholds.almost_full ? 'warning' : 'healthy'

  const wasteFront = `M470 ${surfaceY} Q515 ${surfaceY - 12} 556 ${surfaceY + 1} T640 ${surfaceY + 2} L620 ${floorY} L490 ${floorY} Z`
  const wasteSide = `M640 ${surfaceY + 2} L706 ${surfaceY + 36} L682 462 L620 ${floorY} Z`
  const echoLabelY = 118 + (surfaceY - 118) * 0.52

  return (
    <section className={'scene-stage ' + (bin.is_running ? 'scene-running' : 'scene-paused')} aria-label={`Section drawing of bin ${bin.id}, ${Math.round(fill)} percent full, sensor distance ${distance.toFixed(1)} centimetres`}>
      <div className="scene-paper" />
      <svg className="scene-drawing" viewBox="0 0 1000 520" role="img">
        <defs>
          <pattern id={'hatch-' + safeId} width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#0f2239" strokeOpacity=".2" strokeWidth="1.1" />
          </pattern>
          <clipPath id={'front-' + safeId}>
            <path d="M470 175 L640 175 L620 470 L490 470 Z" />
          </clipPath>
          <clipPath id={'side-' + safeId}>
            <path d="M640 175 L706 205 L682 462 L620 470 Z" />
          </clipPath>
        </defs>

        {/* floor */}
        <path d="M330 470 H790" stroke="#0f2239" strokeOpacity=".32" strokeWidth="1.2" />
        <path d="M330 478 H790" stroke="#0f2239" strokeOpacity=".13" strokeWidth="1" strokeDasharray="12 9" />

        {/* bin shell */}
        <path d="M640 175 L706 205 L682 462 L620 470 Z" fill="#f1e8d8" fillOpacity=".9" stroke="#0f2239" strokeWidth="2" strokeLinejoin="round" />
        <path d="M470 175 L640 175 L620 470 L490 470 Z" fill="#fdfaf3" fillOpacity=".92" stroke="#0f2239" strokeWidth="2" strokeLinejoin="round" />
        <path d="M484 196 L498 452 M626 196 L612 452" stroke="#0f2239" strokeOpacity=".14" strokeWidth="1" />

        {/* waste volume */}
        {fill > 0 && <>
          <g clipPath={'url(#side-' + safeId + ')'}>
            <path d={wasteSide} fill={'url(#hatch-' + safeId + ')'} />
          </g>
          <g clipPath={'url(#front-' + safeId + ')'}>
            <path d={wasteFront} fill={'url(#hatch-' + safeId + ')'} />
          </g>
          <path d={`M470 ${surfaceY} Q515 ${surfaceY - 12} 556 ${surfaceY + 1} T640 ${surfaceY + 2}`} fill="none" stroke="#0f2239" strokeWidth="2.4" strokeLinecap="round" />
        </>}

        {/* lid */}
        <path d="M470 165 L640 165 L706 195 L536 195 Z" fill="#e5d8c5" stroke="#0f2239" strokeWidth="2" strokeLinejoin="round" />
        <path d="M470 165 L640 165 L640 179 L470 179 Z" fill="#d9c9ab" stroke="#0f2239" strokeWidth="2" strokeLinejoin="round" />
        <path d="M640 165 L706 195 L706 209 L640 179 Z" fill="#cbb894" stroke="#0f2239" strokeWidth="2" strokeLinejoin="round" />

        {/* sensor module */}
        <path d="M508 118 V150 M592 118 V150 M496 150 H604" stroke="#0f2239" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="510" y="76" width="80" height="42" rx="3" fill="#fdfaf3" stroke="#0f2239" strokeWidth="2" />
        <circle cx="530" cy="97" r="10" fill="#f8f1e6" stroke="#0f2239" strokeWidth="1.6" />
        <circle cx="570" cy="97" r="10" fill="#f8f1e6" stroke="#0f2239" strokeWidth="1.6" />
        <path d="M530 97 H570" stroke="#0f2239" strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 4" />

        {/* echo dimension, drawn from the sensor face to the waste surface */}
        <g className="scene-echo">
          <path d={`M550 118 V${surfaceY}`} stroke="#0f2239" strokeWidth="1.1" strokeDasharray="6 5" />
          <path d={`M544 124 L550 118 L556 124`} fill="none" stroke="#0f2239" strokeWidth="1.4" />
          <path d={`M544 ${surfaceY - 6} L550 ${surfaceY} L556 ${surfaceY - 6}`} fill="none" stroke="#0f2239" strokeWidth="1.4" />
        </g>
        <text className="scene-echo-value" x="560" y={echoLabelY}>{distance.toFixed(1)} cm</text>
        <text className="scene-note" x="560" y={echoLabelY + 16}>{echoMicroseconds.toFixed(0)} µs round trip</text>

        {/* usable range bracket */}
        <path d="M745 175 V470" stroke="#0f2239" strokeOpacity=".55" strokeWidth="1.2" />
        <path d="M739 181 L745 175 L751 181" fill="none" stroke="#0f2239" strokeWidth="1.4" />
        <path d="M739 464 L745 470 L751 464" fill="none" stroke="#0f2239" strokeWidth="1.4" />
        <path d="M745 312 H772" stroke="#0f2239" strokeOpacity=".35" strokeWidth="1" />
        <text className="scene-note" x="780" y="172">0% — {bin.capacity_cm.toFixed(1)} cm to sensor</text>
        <text className="scene-note" x="780" y="466">100% — {config.simulation.full_distance_cm.toFixed(1)} cm to sensor</text>
        <text className="scene-label" x="780" y="316">USABLE RANGE</text>

        {/* callouts */}
        <g className="scene-callout">
          <path d="M250 88 H420 L508 90" fill="none" stroke="#a49a8c" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="508" cy="90" r="3" fill="#f86b1d" />
          <text className="scene-label" x="40" y="84">ULTRASONIC MODULE</text>
          <text className="scene-note" x="40" y="104">HC-SR04 · top mounted</text>
        </g>
        <g className="scene-callout">
          <path d={`M250 336 H340 L${476} ${surfaceY}`} fill="none" stroke="#a49a8c" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx="476" cy={surfaceY} r="3" fill="#f86b1d" />
          <text className="scene-label" x="40" y="332">WASTE SURFACE</text>
          <text className="scene-note" x="40" y="352">{Math.round(fill)}% of usable capacity</text>
        </g>

        {/* figure on the drawing */}
        <text className="scene-figure" x="482" y={surfaceY - 12}>{Math.round(fill)}%</text>
      </svg>

      <div className="scene-titleblock">
        <div><span className="scene-tb-key">SECTION</span><span className="scene-tb-value">A—A</span></div>
        <div><span className="scene-tb-key">UNIT</span><span className="scene-tb-value">{bin.id}</span></div>
        <div><span className="scene-tb-key">LOCATION</span><span className="scene-tb-value">{bin.name}</span></div>
        <div><span className="scene-tb-key">EMPTY</span><span className="scene-tb-value">{bin.capacity_cm.toFixed(1)} cm</span></div>
        <div><span className="scene-tb-key">FULL</span><span className="scene-tb-value">{config.simulation.full_distance_cm.toFixed(1)} cm</span></div>
        <div><span className="scene-tb-key">STATE</span><span className={'scene-tb-value scene-state-' + tone}>{bin.is_running ? 'Live' : 'Held'} · {status}</span></div>
      </div>
    </section>
  )
}
