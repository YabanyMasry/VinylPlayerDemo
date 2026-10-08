import { useEffect, useMemo, useRef, useState, forwardRef, memo, useId } from 'react'
import './ElevenLabsMatrix.css'

/* ── helpers ─────────────────────────────────────────────────── */

function clamp(v) { return Math.max(0, Math.min(1, v)) }

function ensureFrameSize(frame, rows, cols) {
  const r = []
  for (let row = 0; row < rows; row++) {
    const src = frame[row] || []
    r.push([])
    for (let col = 0; col < cols; col++) {
      r[row][col] = src[col] ?? 0
    }
  }
  return r
}

function emptyFrame(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

function setPixel(frame, row, col, value) {
  if (row >= 0 && row < frame.length && col >= 0 && col < frame[0].length) {
    frame[row][col] = value
  }
}

/* ── animation hook ──────────────────────────────────────────── */

function useAnimation(frames, { fps, autoplay, loop, onFrame }) {
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const frameIdRef = useRef(undefined)
  const lastTimeRef = useRef(0)
  const accRef = useRef(0)

  // Keep a stable ref to the callback to avoid restarting the RAF loop
  const stateRef = useRef({ frames, isPlaying, fps, loop, onFrame })
  useEffect(() => {
    stateRef.current = { frames, isPlaying, fps, loop, onFrame }
  })

  useEffect(() => {
    if (!frames || frames.length === 0 || !isPlaying) return
    const interval = 1000 / fps

    const animate = (t) => {
      // Pause updates when tab is hidden to save CPU
      if (document.hidden) {
        frameIdRef.current = requestAnimationFrame(animate)
        return
      }

      if (lastTimeRef.current === 0) lastTimeRef.current = t
      let dt = t - lastTimeRef.current
      lastTimeRef.current = t

      // Clamp large dt to prevent catch-up bursts after backgrounding
      if (dt > 250) dt = interval

      accRef.current += dt
      if (accRef.current >= interval) {
        accRef.current -= interval
        setFrameIndex(prev => {
          const { frames: f, loop: l, onFrame: of_ } = stateRef.current
          const next = prev + 1
          if (next >= f.length) {
            if (l) { of_?.(0); return 0 }
            setIsPlaying(false)
            return prev
          }
          of_?.(next)
          return next
        })
      }
      frameIdRef.current = requestAnimationFrame(animate)
    }
    frameIdRef.current = requestAnimationFrame(animate)
    return () => { if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current) }
    // Only restart when isPlaying or fps changes — NOT on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, fps])

  useEffect(() => {
    setFrameIndex(0)
    setIsPlaying(autoplay)
    lastTimeRef.current = 0
    accRef.current = 0
  }, [frames, autoplay])

  return { frameIndex, isPlaying }
}

/* ── presets ──────────────────────────────────────────────────── */

export const digits = [
  [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]],
  [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,1,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
  [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  [[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0]],
]

export const chevronLeft = [[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]]
export const chevronRight = [[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0]]

export const loader = (() => {
  const frames = []
  const sz = 7, center = 3, radius = 2.5
  for (let f = 0; f < 12; f++) {
    const fr = emptyFrame(sz, sz)
    for (let i = 0; i < 8; i++) {
      const angle = (f / 12) * Math.PI * 2 + (i / 8) * Math.PI * 2
      const x = Math.round(center + Math.cos(angle) * radius)
      const y = Math.round(center + Math.sin(angle) * radius)
      setPixel(fr, y, x, Math.max(0.2, 1 - i / 10))
    }
    frames.push(fr)
  }
  return frames
})()

export const pulse = (() => {
  const frames = []
  const sz = 7, center = 3
  for (let f = 0; f < 16; f++) {
    const fr = emptyFrame(sz, sz)
    const phase = (f / 16) * Math.PI * 2
    const intensity = (Math.sin(phase) + 1) / 2
    setPixel(fr, center, center, 1)
    const r = Math.floor((1 - intensity) * 3) + 1
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (Math.abs(dist - r) < 0.7) setPixel(fr, center + dy, center + dx, intensity * 0.6)
      }
    frames.push(fr)
  }
  return frames
})()

export function vu(columns, levels) {
  const rows = 7
  const frame = emptyFrame(rows, columns)
  for (let col = 0; col < Math.min(columns, levels.length); col++) {
    const level = Math.max(0, Math.min(1, levels[col]))
    const height = Math.floor(level * rows)
    for (let row = 0; row < rows; row++) {
      const fromBottom = rows - 1 - row
      if (fromBottom < height) {
        frame[row][col] = row < rows * 0.3 ? 1 : row < rows * 0.6 ? 0.8 : 0.6
      }
    }
  }
  return frame
}

export const wave = (() => {
  const frames = [], rows = 7, cols = 7
  for (let f = 0; f < 24; f++) {
    const fr = emptyFrame(rows, cols)
    const phase = (f / 24) * Math.PI * 2
    for (let col = 0; col < cols; col++) {
      const cp = (col / cols) * Math.PI * 2
      const h = Math.sin(phase + cp) * 2.5 + 3.5
      const row = Math.floor(h)
      if (row >= 0 && row < rows) {
        setPixel(fr, row, col, 1)
        const frac = h - row
        if (row > 0) setPixel(fr, row - 1, col, 1 - frac)
        if (row < rows - 1) setPixel(fr, row + 1, col, frac)
      }
    }
    frames.push(fr)
  }
  return frames
})()

export const snake = (() => {
  const frames = [], rows = 7, cols = 7
  const path = []
  let x = 0, y = 0, dx = 1, dy = 0
  const visited = new Set()
  while (path.length < rows * cols) {
    path.push([y, x])
    visited.add(`${y},${x}`)
    let nx = x + dx, ny = y + dy
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(`${ny},${nx}`)) {
      x = nx; y = ny
    } else {
      const ndx = -dy, ndy = dx
      dx = ndx; dy = ndy
      nx = x + dx; ny = y + dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(`${ny},${nx}`)) {
        x = nx; y = ny
      } else break
    }
  }
  const snakeLen = 5
  for (let f = 0; f < path.length; f++) {
    const fr = emptyFrame(rows, cols)
    for (let i = 0; i < snakeLen; i++) {
      const idx = f - i
      if (idx >= 0 && idx < path.length) {
        const [py, px] = path[idx]
        setPixel(fr, py, px, 1 - i / snakeLen)
      }
    }
    frames.push(fr)
  }
  return frames
})()

/* ── Matrix component ────────────────────────────────────────── */

const MatrixInner = forwardRef(function Matrix({
  rows,
  cols,
  pattern,
  frames,
  fps = 12,
  autoplay = true,
  loop = true,
  size = 10,
  gap = 2,
  palette = { on: 'currentColor', off: 'rgba(255,255,255,0.15)' },
  brightness = 1,
  ariaLabel,
  onFrame,
  mode = 'default',
  levels,
  className = '',
  ...props
}, ref) {
  // Unique IDs per instance to avoid SVG gradient collisions across multiple Matrix instances
  const uid = useId().replace(/:/g, '')
  const idOn = `mpx-on-${uid}`
  const idOff = `mpx-off-${uid}`
  const idGlow = `mpx-glow-${uid}`

  const { frameIndex } = useAnimation(frames, {
    fps,
    autoplay: autoplay && !pattern,
    loop,
    onFrame,
  })

  const currentFrame = useMemo(() => {
    if (mode === 'vu' && levels && levels.length > 0) return ensureFrameSize(vu(cols, levels), rows, cols)
    if (pattern) return ensureFrameSize(pattern, rows, cols)
    if (frames && frames.length > 0) return ensureFrameSize(frames[frameIndex] || frames[0], rows, cols)
    return ensureFrameSize([], rows, cols)
  }, [pattern, frames, frameIndex, rows, cols, mode, levels])

  const cellPositions = useMemo(() => {
    const p = []
    for (let r = 0; r < rows; r++) {
      p[r] = []
      for (let c = 0; c < cols; c++) {
        p[r][c] = { x: c * (size + gap), y: r * (size + gap) }
      }
    }
    return p
  }, [rows, cols, size, gap])

  const svgW = cols * (size + gap) - gap
  const svgH = rows * (size + gap) - gap

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? 'matrix display'}
      className={`el-matrix ${className}`}
      style={{
        '--matrix-on': palette.on,
        '--matrix-off': palette.off,
        '--matrix-gap': `${gap}px`,
        '--matrix-size': `${size}px`,
      }}
      {...props}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={idOn} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--matrix-on)" stopOpacity="1" />
            <stop offset="70%" stopColor="var(--matrix-on)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--matrix-on)" stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id={idOff} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--matrix-off)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--matrix-off)" stopOpacity="0.7" />
          </radialGradient>
          <filter id={idGlow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {currentFrame.map((row, ri) =>
          row.map((value, ci) => {
            const pos = cellPositions[ri]?.[ci]
            if (!pos) return null
            const opacity = clamp(brightness * value)
            const isActive = opacity > 0.5
            const isOn = opacity > 0.05
            const fill = isOn ? `url(#${idOn})` : `url(#${idOff})`
            const scale = isActive ? 1.1 : 1
            const radius = (size / 2) * 0.9

            return (
              <circle
                key={`${ri}-${ci}`}
                className={`matrix-pixel ${isActive ? 'matrix-pixel-active' : ''}`}
                cx={pos.x + size / 2}
                cy={pos.y + size / 2}
                r={radius}
                fill={fill}
                opacity={isOn ? opacity : 0.1}
                style={{ transform: `scale(${scale})`, transformOrigin: 'center', transformBox: 'fill-box' }}
              />
            )
          })
        )}
      </svg>
    </div>
  )
})

// React.memo: only re-render if meaningful props changed
export const Matrix = memo(MatrixInner, (prev, next) => {
  // Re-render if any of these change
  if (prev.rows !== next.rows) return false
  if (prev.cols !== next.cols) return false
  if (prev.fps !== next.fps) return false
  if (prev.size !== next.size) return false
  if (prev.gap !== next.gap) return false
  if (prev.brightness !== next.brightness) return false
  if (prev.mode !== next.mode) return false
  if (prev.className !== next.className) return false
  // Deep compare palette
  if (prev.palette?.on !== next.palette?.on) return false
  if (prev.palette?.off !== next.palette?.off) return false
  // Array identity checks (stable refs from useMemo are fine)
  if (prev.frames !== next.frames) return false
  if (prev.pattern !== next.pattern) return false
  if (prev.levels !== next.levels) return false
  // Skip re-render — props are equal
  return true
})
