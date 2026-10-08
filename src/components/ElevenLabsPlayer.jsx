import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './ElevenLabsPlayer.css'

/* ── helpers ─────────────────────────────────────────────────── */

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const mm = mins < 10 ? `0${mins}` : mins
  const ss = secs < 10 ? `0${secs}` : secs
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mins}:${ss}`
}

/* ── contexts ────────────────────────────────────────────────── */

const ELPlayerCtx = createContext(null)
const ELTimeCtx = createContext(0)

export function useELPlayer() {
  const ctx = useContext(ELPlayerCtx)
  if (!ctx) throw new Error('useELPlayer must be inside <ELPlayerProvider>')
  return ctx
}

export function useELPlayerTime() {
  return useContext(ELTimeCtx)
}

/* ── animation frame hook ────────────────────────────────────── */

function useAnimationFrame(cb) {
  const reqRef = useRef(null)
  const prevRef = useRef(null)
  const cbRef = useRef(cb)
  useEffect(() => { cbRef.current = cb }, [cb])

  useEffect(() => {
    const tick = (t) => {
      if (prevRef.current !== null) cbRef.current(t - prevRef.current)
      prevRef.current = t
      reqRef.current = requestAnimationFrame(tick)
    }
    reqRef.current = requestAnimationFrame(tick)
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current)
      prevRef.current = null
    }
  }, [])
}

/* ── provider ────────────────────────────────────────────────── */

export function ELPlayerProvider({ children }) {
  const audioRef = useRef(null)
  const itemRef = useRef(null)
  const playPromiseRef = useRef(null)

  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(undefined)
  const [error, setError] = useState(null)
  const [activeItem, _setActiveItem] = useState(null)
  const [paused, setPaused] = useState(true)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const [readyState, setReadyState] = useState(0)
  const [networkState, setNetworkState] = useState(0)

  const setActiveItem = useCallback(async (item) => {
    if (!audioRef.current) return
    if (item?.id === itemRef.current?.id) return
    itemRef.current = item
    const rate = audioRef.current.playbackRate
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    if (item === null) {
      audioRef.current.removeAttribute('src')
    } else {
      audioRef.current.src = item.src
    }
    audioRef.current.load()
    audioRef.current.playbackRate = rate
  }, [])

  const play = useCallback(async (item) => {
    if (!audioRef.current) return
    if (playPromiseRef.current) {
      try { await playPromiseRef.current } catch {}
    }
    if (item === undefined) {
      playPromiseRef.current = audioRef.current.play()
      return playPromiseRef.current
    }
    if (item?.id === activeItem?.id) {
      playPromiseRef.current = audioRef.current.play()
      return playPromiseRef.current
    }
    itemRef.current = item
    const rate = audioRef.current.playbackRate
    if (!audioRef.current.paused) audioRef.current.pause()
    audioRef.current.currentTime = 0
    if (item === null) {
      audioRef.current.removeAttribute('src')
    } else {
      audioRef.current.src = item.src
    }
    audioRef.current.load()
    audioRef.current.playbackRate = rate
    playPromiseRef.current = audioRef.current.play()
    return playPromiseRef.current
  }, [activeItem])

  const pause = useCallback(async () => {
    if (!audioRef.current) return
    if (playPromiseRef.current) {
      try { await playPromiseRef.current } catch {}
    }
    audioRef.current.pause()
    playPromiseRef.current = null
  }, [])

  const seek = useCallback((t) => {
    if (audioRef.current) audioRef.current.currentTime = t
  }, [])

  const setPlaybackRate = useCallback((rate) => {
    if (!audioRef.current) return
    audioRef.current.playbackRate = rate
    setPlaybackRateState(rate)
  }, [])

  const isItemActive = useCallback(
    (id) => activeItem?.id === id,
    [activeItem],
  )

  useAnimationFrame(() => {
    const a = audioRef.current
    if (!a) return
    _setActiveItem(itemRef.current)
    setReadyState(a.readyState)
    setNetworkState(a.networkState)
    setTime(a.currentTime)
    setDuration(a.duration)
    setPaused(a.paused)
    setError(a.error)
    setPlaybackRateState(a.playbackRate)
  })

  const isPlaying = !paused
  const isBuffering = readyState < 3 && networkState === 2

  const api = useMemo(() => ({
    ref: audioRef,
    activeItem,
    duration,
    error,
    isPlaying,
    isBuffering,
    playbackRate,
    isItemActive,
    setActiveItem,
    play,
    pause,
    seek,
    setPlaybackRate,
  }), [
    activeItem, duration, error, isPlaying, isBuffering, playbackRate,
    isItemActive, setActiveItem, play, pause, seek, setPlaybackRate,
  ])

  return (
    <ELPlayerCtx.Provider value={api}>
      <ELTimeCtx.Provider value={time}>
        <audio ref={audioRef} crossOrigin="anonymous" style={{ display: 'none' }} />
        {children}
      </ELTimeCtx.Provider>
    </ELPlayerCtx.Provider>
  )
}

/* ── play button ─────────────────────────────────────────────── */

export function ELPlayButton({ item, className = '', ...rest }) {
  const player = useELPlayer()

  const playing = item
    ? player.isItemActive(item.id) && player.isPlaying
    : player.isPlaying

  const loading = item
    ? player.isItemActive(item.id) && player.isBuffering && player.isPlaying
    : player.isBuffering && player.isPlaying

  const toggle = () => {
    if (playing) {
      player.pause()
    } else {
      player.play(item)
    }
  }

  return (
    <button
      type="button"
      className={`el-play-btn ${playing ? 'el-play-btn--playing' : ''} ${className}`}
      onClick={toggle}
      aria-label={playing ? 'Pause' : 'Play'}
      {...rest}
    >
      {loading ? (
        <span className="el-spinner" />
      ) : playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M8 5.14v14l11-7l-11-7z" />
        </svg>
      )}
    </button>
  )
}

/* ── progress slider ─────────────────────────────────────────── */

export function ELProgress({ className = '' }) {
  const player = useELPlayer()
  const time = useELPlayerTime()
  const wasPlayingRef = useRef(false)

  const max = Number.isFinite(player.duration) ? player.duration : 0
  const pct = max > 0 ? (time / max) * 100 : 0

  return (
    <input
      type="range"
      className={`el-progress ${className}`}
      min={0}
      max={max}
      step={0.25}
      value={time}
      style={{ '--el-pct': `${pct}%` }}
      onPointerDown={() => {
        wasPlayingRef.current = player.isPlaying
        player.pause()
      }}
      onPointerUp={() => {
        if (wasPlayingRef.current) player.play()
      }}
      onChange={(e) => player.seek(Number(e.target.value))}
      disabled={!max}
      aria-label="Seek"
    />
  )
}

/* ── time display ────────────────────────────────────────────── */

export function ELTime({ className = '' }) {
  const time = useELPlayerTime()
  return <span className={`el-time ${className}`}>{formatTime(time)}</span>
}

/* ── duration display ────────────────────────────────────────── */

export function ELDuration({ className = '' }) {
  const { duration } = useELPlayer()
  return (
    <span className={`el-time ${className}`}>
      {duration !== undefined && !Number.isNaN(duration)
        ? formatTime(duration)
        : '--:--'}
    </span>
  )
}

/* ── speed control ───────────────────────────────────────────── */

const DEFAULT_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function ELSpeedControl({ speeds = DEFAULT_SPEEDS, className = '' }) {
  const player = useELPlayer()

  return (
    <div className={`el-speed-group ${className}`} role="group" aria-label="Playback speed">
      {speeds.map((s) => (
        <button
          key={s}
          type="button"
          className={`el-speed-btn ${player.playbackRate === s ? 'el-speed-btn--active' : ''}`}
          onClick={() => player.setPlaybackRate(s)}
        >
          {s === 1 ? '1×' : `${s}×`}
        </button>
      ))}
    </div>
  )
}

/* ── example tracks (mirrors ElevenLabs demo) ────────────────── */

export const exampleTracks = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  src: `https://storage.googleapis.com/eleven-public-cdn/audio/ui-elevenlabs-io/0${i}.mp3`,
  data: { title: `II - 0${i}` },
}))
