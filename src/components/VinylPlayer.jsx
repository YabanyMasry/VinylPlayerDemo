import { useEffect, useRef, useState, useMemo, memo } from 'react'
import gsap from 'gsap'
import { Matrix, digits } from './ElevenLabsMatrix'
import { LiveWaveform } from './ElevenLabsLiveWaveform'
import ImageDotMatrix from './ImageDotMatrix'
import vinylImage from '../assets/Vinyl.png'
import './VinylPlayer.css'

const DEFAULT_VINYL_COLOR = ['#2d2d2d', '#4a4a4a']
const VINYL_COLOR_CACHE = new Map()
const VINYL_COLOR_PENDING = new Map()

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(r, g, b) {
  return `#${clamp255(r).toString(16).padStart(2, '0')}${clamp255(g).toString(16).padStart(2, '0')}${clamp255(b).toString(16).padStart(2, '0')}`
}

function colorDistance(a, b) {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function extractDominantVinylColors(imageUrl) {
  if (VINYL_COLOR_CACHE.has(imageUrl)) {
    return Promise.resolve(VINYL_COLOR_CACHE.get(imageUrl))
  }

  if (VINYL_COLOR_PENDING.has(imageUrl)) {
    return VINYL_COLOR_PENDING.get(imageUrl)
  }

  const pendingWork = new Promise((resolve) => {
    const complete = (colors) => {
      const safeColors = Array.isArray(colors) && colors.length === 2 ? colors : DEFAULT_VINYL_COLOR
      if (imageUrl) {
        VINYL_COLOR_CACHE.set(imageUrl, safeColors)
      }
      VINYL_COLOR_PENDING.delete(imageUrl)
      resolve(safeColors)
    }

    if (!imageUrl || typeof document === 'undefined' || typeof Image === 'undefined') {
      complete(DEFAULT_VINYL_COLOR)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          complete(DEFAULT_VINYL_COLOR)
          return
        }

        const sampleSize = 48
        canvas.width = sampleSize
        canvas.height = sampleSize
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize)

        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const buckets = new Map()

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 140) continue

          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

          if (luma < 12 || luma > 245) continue

          const qr = Math.round(r / 20) * 20
          const qg = Math.round(g / 20) * 20
          const qb = Math.round(b / 20) * 20
          const key = `${qr},${qg},${qb}`
          buckets.set(key, (buckets.get(key) || 0) + 1)
        }

        if (buckets.size === 0) {
          complete(DEFAULT_VINYL_COLOR)
          return
        }

        const ranked = [...buckets.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([key]) => key.split(',').map(Number))

        const primary = ranked[0]
        let secondary = ranked.find((rgb) => colorDistance(rgb, primary) > 52)

        if (!secondary) {
          const shift = (0.2126 * primary[0] + 0.7152 * primary[1] + 0.0722 * primary[2]) > 120 ? -40 : 40
          secondary = [primary[0] + shift, primary[1] + shift, primary[2] + shift]
        }

        // Matte-ify: convert to HSL, crush saturation and pull lightness down
        // so the vinyl label looks pressed/subdued rather than vivid.
        const matteRgb = (r, g, b) => {
          const rn = r / 255, gn = g / 255, bn = b / 255
          const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
          let h, s, l = (max + min) / 2

          if (max === min) {
            h = s = 0
          } else {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
              case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break
              case gn: h = ((bn - rn) / d + 2) / 6; break
              default: h = ((rn - gn) / d + 4) / 6
            }
          }

          // Reduce saturation by 65%, cap lightness to [0.12, 0.30] for a dark matte look
          s = s * 0.35
          l = Math.max(0.12, Math.min(0.30, l * 0.7))

          // HSL back to RGB
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
          }
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s
          const p = 2 * l - q
          return [
            Math.round(hue2rgb(p, q, h + 1/3) * 255),
            Math.round(hue2rgb(p, q, h) * 255),
            Math.round(hue2rgb(p, q, h - 1/3) * 255),
          ]
        }

        const [pr, pg, pb] = matteRgb(primary[0], primary[1], primary[2])
        const [sr, sg, sb] = matteRgb(secondary[0], secondary[1], secondary[2])

        complete([
          rgbToHex(pr, pg, pb),
          rgbToHex(sr, sg, sb),
        ])
      } catch {
        complete(DEFAULT_VINYL_COLOR)
      }
    }

    img.onerror = () => complete(DEFAULT_VINYL_COLOR)
    img.src = imageUrl
  })

  VINYL_COLOR_PENDING.set(imageUrl, pendingWork)
  return pendingWork
}

const FONT = {
  A: '01110,10001,10001,11111,10001,10001,10001',
  B: '11110,10001,10001,11110,10001,10001,11110',
  C: '01111,10000,10000,10000,10000,10000,01111',
  D: '11110,10001,10001,10001,10001,10001,11110',
  E: '11111,10000,10000,11110,10000,10000,11111',
  F: '11111,10000,10000,11110,10000,10000,10000',
  G: '01111,10000,10000,10011,10001,10001,01111',
  H: '10001,10001,10001,11111,10001,10001,10001',
  I: '01110,00100,00100,00100,00100,00100,01110',
  J: '00111,00010,00010,00010,10010,10010,01100',
  K: '10001,10010,10100,11000,10100,10010,10001',
  L: '10000,10000,10000,10000,10000,10000,11111',
  M: '10001,11011,10101,10101,10001,10001,10001',
  N: '10001,11001,11001,10101,10011,10011,10001',
  O: '01110,10001,10001,10001,10001,10001,01110',
  P: '11110,10001,10001,11110,10000,10000,10000',
  Q: '01110,10001,10001,10001,10101,10010,01101',
  R: '11110,10001,10001,11110,10100,10010,10001',
  S: '01111,10000,10000,01110,00001,00001,11110',
  T: '11111,00100,00100,00100,00100,00100,00100',
  U: '10001,10001,10001,10001,10001,10001,01110',
  V: '10001,10001,10001,10001,10001,01010,00100',
  W: '10001,10001,10001,10101,10101,11011,10001',
  X: '10001,10001,01010,00100,01010,10001,10001',
  Y: '10001,10001,10001,01010,00100,00100,00100',
  Z: '11111,00001,00010,00100,01000,10000,11111',
  ' ': '00000,00000,00000,00000,00000,00000,00000',
  '-': '00000,00000,00000,11111,00000,00000,00000',
  ',': '00000,00000,00000,00000,00000,00110,00100',
  "'": '00100,00100,00010,00000,00000,00000,00000',
  '!': '00100,00100,00100,00100,00100,00000,00100',
  '"': '01010,01010,01010,00000,00000,00000,00000',
  '#': '01010,11111,01010,01010,11111,01010,01010',
  '$': '00100,01111,10100,01110,00101,11110,00100',
  '%': '11001,11010,00100,00100,01011,10011,00000',
  '&': '01100,10010,10100,01000,10101,10010,01101',
  '*': '00000,00100,10101,01110,10101,00100,00000',
  '+': '00000,00100,00100,11111,00100,00100,00000',
  '/': '00001,00010,00100,01000,10000,00000,00000',
  ':': '00000,00100,00100,00000,00100,00100,00000',
  ';': '00000,00110,00110,00000,00110,00100,01000',
  '<': '00010,00100,01000,10000,01000,00100,00010',
  '=': '00000,11111,00000,11111,00000,00000,00000',
  '>': '01000,00100,00010,00001,00010,00100,01000',
  '@': '01110,10001,10111,10101,10111,10000,01110',
  '[': '01110,01000,01000,01000,01000,01000,01110',
  '\\': '10000,01000,00100,00010,00001,00000,00000',
  ']': '01110,00010,00010,00010,00010,00010,01110',
  '^': '00100,01010,10001,00000,00000,00000,00000',
  '_': '00000,00000,00000,00000,00000,00000,11111',
  '`': '00100,00010,00000,00000,00000,00000,00000',
  '{': '00010,00100,00100,01000,00100,00100,00010',
  '|': '00100,00100,00100,00100,00100,00100,00100',
  '}': '01000,00100,00100,00010,00100,00100,01000',
  '~': '00000,00000,01001,10110,00000,00000,00000',
  '(': '00010,00100,01000,01000,01000,00100,00010',
  ')': '01000,00100,00010,00010,00010,00100,01000',
  '?': '01110,10001,00010,00100,00100,00000,00100',
  '.': '00000,00000,00000,00000,00000,01100,01100',
};

const STR_CACHE = {};

function createUnicodeFallbackMatrix(char) {
  const codePoint = (char && char.codePointAt(0)) || 0x3f
  let value = codePoint
  const mat = Array.from({ length: 7 }, () => Array(5).fill(0))

  for (let row = 0; row < 7; row++) {
    mat[row][0] = 1
    mat[row][4] = 1
  }

  for (let row = 6; row >= 0; row--) {
    for (let col = 3; col >= 1; col--) {
      mat[row][col] = value & 1
      value >>= 1
    }
  }

  return mat
}

function normalizeToBasicLatin(char) {
  const upper = (char || ' ').toUpperCase()
  if (FONT[upper]) return upper

  const base = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (base && FONT[base[0]]) return base[0]

  return upper
}

function getCharMatrix(char) {
  const input = char || ' '
  if (STR_CACHE[input]) return STR_CACHE[input]

  const normalized = normalizeToBasicLatin(input)

  if (/^[0-9]$/.test(normalized)) {
    const digit = digits[parseInt(normalized, 10)]
    STR_CACHE[input] = digit
    return digit
  }

  if (FONT[normalized]) {
    const mat = FONT[normalized].split(',').map((row) => row.split('').map(Number))
    STR_CACHE[input] = mat
    return mat
  }

  const unicodeMat = createUnicodeFallbackMatrix(input)
  STR_CACHE[input] = unicodeMat
  return unicodeMat
}

function createTextFrames(text, viewCols) {
  const chars = Array.from(text || '').map(getCharMatrix);
  const rows = 7;
  const textCols = chars.length === 0 ? 0 : chars.length * 6 - 1;
  const totalCols = viewCols + textCols + viewCols;
  const fullPattern = Array.from({ length: rows }, () => Array(totalCols).fill(0));
  chars.forEach((mat, i) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        fullPattern[r][viewCols + i * 6 + c] = mat[r][c] || 0;
      }
    }
  });

  const frames = [];
  const shiftCount = viewCols + textCols;
  for (let shift = 0; shift < shiftCount; shift++) {
    const frame = [];
    for (let r = 0; r < rows; r++) {
      frame.push(fullPattern[r].slice(shift, shift + viewCols));
    }
    frames.push(frame);
  }
  return frames.length ? frames : [Array.from({ length: rows }, () => Array(viewCols).fill(0))];
}

function cleanTitle(title) {
  if (!title) return 'UNKNOWN';
  let cleaned = title.replace(/[\(\[]\s*(feat|ft)\.?\s+[^()\[\]]*[\)\]]/gi, '');
  cleaned = cleaned.replace(/\s+(feat|ft)\.?\s+.*$/gi, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').trim();
  return cleaned.substring(0, 30);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function findActiveLyricIndex(lyrics, timeSeconds) {
  let left = 0
  let right = lyrics.length - 1
  let answer = -1

  while (left <= right) {
    const mid = (left + right) >> 1
    if (timeSeconds >= lyrics[mid].time) {
      answer = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return answer
}

// ============================================================================
// PERFORMANCE FIX 1: Isolate the 1-second interval so it doesn't re-render the whole player
// ============================================================================
const StatusPulse = ({ isPlaying }) => {
  const [pulse, setPulse] = useState(1);
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => setPulse(p => p === 1 ? 0.2 : 1), 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <Matrix
      rows={1} cols={1} pattern={isPlaying ? [[pulse]] : [[0.1]]}
      size={6} gap={0}
      palette={{ on: '#ffffff', off: 'rgba(255, 255, 255, 0.15)' }}
    />
  );
};

function VinylPlayer({ isPlaying, coverUrl, className = '', audioElement, trackNumber = 1, songName = '', albumName = '', artistName = '', albumTrackCount = 0, durationSeconds = 0, volume = 0.8, onVolumeChange, playbackRate = 1, onPlaybackRateChange, audioEffects = {}, onEffectChange, onResetDefaults, onPrevAlbum, onNextAlbum, onTogglePlay, lyrics = [], currentTime = 0, onSeek, tracks = [], currentIndex = 0, onSelectTrack }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [vinylColor, setVinylColor] = useState(DEFAULT_VINYL_COLOR)
  const lyricsContainerRef = useRef(null);

  useEffect(() => {
    let cancelled = false

    const resolveVinylColors = async () => {
      const nextColors = await extractDominantVinylColors(coverUrl)
      if (!cancelled) setVinylColor(nextColors)
    }

    resolveVinylColors()

    return () => {
      cancelled = true
    }
  }, [coverUrl])

  // Throttle lyric index calculation to max every 250ms to avoid work on every audio frame
  const lastLyricCheckRef = useRef(0)
  const cachedLyricIndexRef = useRef(-1)
  const activeIndex = useMemo(() => {
    if (!showLyrics || !Array.isArray(lyrics) || lyrics.length === 0) return -1
    const now = performance.now()
    if (now - lastLyricCheckRef.current < 250 && cachedLyricIndexRef.current !== -1) {
      return cachedLyricIndexRef.current
    }
    lastLyricCheckRef.current = now
    const idx = findActiveLyricIndex(lyrics, currentTime)
    cachedLyricIndexRef.current = idx
    return idx
  }, [lyrics, currentTime, showLyrics]);

  // ============================================================================
  // PERFORMANCE FIX 2: Spotify-style smooth GSAP scrolling (No clunky native jumps)
  // ============================================================================
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current && activeIndex !== -1) {
      const container = lyricsContainerRef.current;
      const activeEl = container.children[activeIndex];

      if (activeEl) {
        // Calculate exact center position
        const targetScrollTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);

        // Use GSAP for buttery smooth scrolling that doesn't stutter on React renders
        gsap.to(container, {
          scrollTop: targetScrollTop,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }
  }, [activeIndex, showLyrics]);

  const vinylRef = useRef(null)
  const vinylWrapperRef = useRef(null)
  const tonearmRef = useRef(null)
  const spinTweenRef = useRef(null)

  useEffect(() => {
    if (!vinylRef.current) return

    if (!spinTweenRef.current) {
      spinTweenRef.current = gsap.to(vinylRef.current, {
        rotation: '+=360',
        duration: 2.4,
        ease: 'none',
        repeat: -1,
        paused: true,
      })
    }

    if (isPlaying) {
      spinTweenRef.current.play()
    } else {
      spinTweenRef.current.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (!vinylWrapperRef.current) return
    gsap.fromTo(vinylWrapperRef.current, {
      y: -400,
      rotation: -150,
      opacity: 0,
    }, {
      y: 0,
      rotation: 0,
      opacity: 1,
      duration: 1.8,
      ease: 'power3.out',
      overwrite: 'auto'
    })
  }, [])

  useEffect(() => {
    if (!tonearmRef.current) return
    gsap.to(tonearmRef.current, {
      rotation: isPlaying ? 30 : 0,
      duration: 0.6,
      ease: 'power2.out',
    })
  }, [isPlaying])

  const countDigits = trackNumber
    .toString()
    .padStart(2, "0")
    .split("")
    .map(Number);

  const viewCols = 48;
  const txtFrames = useMemo(() => createTextFrames(cleanTitle(songName), viewCols), [songName]);

  // ============================================================================
  // PERFORMANCE FIX 3: Memoize heavy Canvas/Matrix components to stop lag spikes
  // ============================================================================
  const MemoizedCoverMatrix = useMemo(() => (
    coverUrl ? (
      <ImageDotMatrix
        src={coverUrl}
        cols={8} rows={8} dotSize={10} gap={1.5} opacity={0.9} width="100%" height="100%"
      />
    ) : (
      <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '24px' }}>🎵</div>
    )
  ), [coverUrl]);

  const MemoizedCoverMatrixLarge = useMemo(() => (
    coverUrl ? (
      <ImageDotMatrix
        src={coverUrl}
        cols={16}
        rows={16}
        dotSize={8}
        gap={1.8}
        opacity={0.95}
        width="100%"
        height="100%"
      />
    ) : (
      <div style={{ color: 'rgba(255,255,255,0.07)', fontSize: '42px' }}>🎵</div>
    )
  ), [coverUrl])

  const detailAlbum = albumName || 'Unknown Album'
  const detailArtist = artistName || 'Unknown Artist'
  const detailTrack = cleanTitle(songName)
  const detailTrackPosition = albumTrackCount > 0 ? `${trackNumber}/${albumTrackCount}` : `${trackNumber}`
  const detailDuration = formatDuration(durationSeconds)
  const detailLyricsStatus = Array.isArray(lyrics) && lyrics.length > 0 ? 'Available' : 'Not Available'
  const detailPlaybackState = isPlaying ? 'Playing' : 'Paused'
  const detailSpeed = `${Number.isFinite(playbackRate) ? playbackRate.toFixed(2) : '1.00'}x`
  const detailVolume = `${Math.round((Number.isFinite(volume) ? volume : 0) * 100)}%`

  const MemoizedScrollingTitle = useMemo(() => (
    <Matrix
      className="vp-scrolling-matrix"
      rows={7} cols={viewCols} frames={txtFrames}
      fps={15} size={3.5} gap={1}
      palette={{ on: '#ffffff', off: 'rgba(255,255,255,0.15)' }}
    />
  ), [txtFrames]);

  return (
    <div className={`vp-turntable ${className}`}>
      {/* decorative corner screws */}
      <div className="vp-screw vp-screw--tl" />
      <div className="vp-screw vp-screw--tr" />
      <div className="vp-screw vp-screw--bl" />
      <div className="vp-screw vp-screw--br" />

      {/* power indicator */}
      <div className={`vp-power-dot ${isPlaying ? 'vp-power-dot--on' : 'vp-power-dot--off'}`} />

      {/* platter base */}
      <div className="vp-platter">
        <div className="vp-vinyl-wrapper" ref={vinylWrapperRef}>
          <div className="vp-vinyl" ref={vinylRef}>
            <img src={vinylImage} alt="Vinyl Record" className="vp-vinyl-bg" />
            <div className="vp-label" style={{ background: `linear-gradient(135deg, ${vinylColor[0]}, ${vinylColor[1]})` }}>
              <div className="vp-spindle" />
            </div>
          </div>
        </div>
      </div>

      {/* tonearm */}
      <div className="vp-tonearm-pivot">
        <div className="vp-pivot-ring" />
        <div className="vp-tonearm" ref={tonearmRef}>
          <div className="vp-tonearm-wand"></div>
          <div className="vp-tonearm-bend">
            <div className="vp-tonearm-head"></div>
          </div>
        </div>
      </div>

      {/* digital interface bottom right */}
      <div className="vp-digital-displays">
        {/* Unified Album Navigation Control (Top) */}
        <div style={{ display: 'flex', gap: '18px', marginBottom: '0px', marginRight: '55px', justifyContent: 'center', position: 'relative', zIndex: 50 }}>


          <button
            className="vp-retro-btn"
            onClick={(e) => { e.stopPropagation(); onTogglePlay?.(); }}
            title="Play/Pause"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </button>


          <button
            className="vp-retro-btn"
            style={{ color: showLyrics ? '#fff' : '' }}
            onClick={(e) => { e.stopPropagation(); setShowLyrics(!showLyrics); setShowSecondary(false); }}
            title="Toggle Lyrics"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </button>

          <button
            className="vp-retro-btn"
            style={{ color: showSecondary ? '#fff' : '' }}
            onClick={(e) => { e.stopPropagation(); setShowSecondary(!showSecondary); setShowLyrics(false); }}
            title="Toggle Secondary Panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          <button
            className="vp-retro-btn"
            onClick={(e) => { e.stopPropagation(); onResetDefaults?.(); }}
            style={{ color: '#888' }}
            title="Reset Analogue"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* Scrolling Track Matrix (Top-most) - ALWAYS VISIBLE */}
        <div className="vp-digital-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', width: '260px', height: 'auto', minHeight: '62px', boxSizing: 'border-box', overflow: 'hidden', marginTop: '12px', alignSelf: 'flex-end' }}>
          <div style={{ display: 'flex' }}>
            {MemoizedScrollingTitle}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginTop: '12px', height: '450px' }}>

          {/* Left Column: Permanent Cover Monitor */}
          <div className="vp-digital-panel" style={{ flexDirection: 'column', gap: '16px', padding: '14px', height: 'auto', width: '108px', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {MemoizedCoverMatrix}
            </div>

            {/* The new rectangular album navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '085px', marginTop: '2px' }}>
              <button
                className='vp-retro-btn-rect'
                onClick={(e) => { e.stopPropagation(); onPrevAlbum?.(); }}
                title="Previous Album"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              <button
                className='vp-retro-btn-rect'
                onClick={(e) => { e.stopPropagation(); onNextAlbum?.(); }}
                title="Next Album"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

          </div>


          {/* Right Column: Switching Control/Display Area */}
          <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {showLyrics ? (
              <div
                ref={lyricsContainerRef}
                className="vp-digital-panel vp-lyrics-container"
                style={{
                  padding: '45px 20px', width: '100%', height: '470px', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto'
                }}
              >
                {lyrics.length > 0 ? (
                  lyrics.map((line, idx) => {
                    const isCurrent = idx === activeIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => onSeek?.(line.time)}
                        style={{
                          color: isCurrent ? '#fff' : 'rgba(255,255,255,0.25)',
                          fontSize: '18px',
                          lineHeight: '1.4',
                          fontFamily: "'Doto', sans-serif",
                          fontWeight: isCurrent ? 600 : 400,
                          letterSpacing: '0.01em',
                          transition: 'color 0.4s ease, font-weight 0.4s ease', 
                          cursor: 'pointer',
                          textAlign: 'center',
                          padding: '12px 0'
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', fontFamily: "'Doto', sans-serif", textAlign: 'center', padding: '20px' }}>No lyrics found.</div>
                )}
              </div>
            ) : showSecondary ? (
              <div
                className="vp-digital-panel vp-secondary-panel"
                style={{ flexDirection: 'column', padding: '16px 20px', gap: '12px', height: '470px', boxSizing: 'border-box' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--matrix-off, rgba(255,255,255,0.4))', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    UPCOMING QUEUE
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: '9px' }}>
                    {tracks.length > 0 && currentIndex !== null ? Math.max(0, tracks.length - currentIndex - 1) : 0} TRACKS
                  </span>
                </div>

                <ul className="vp-tracklist" style={{ flex: 1, overflowY: 'auto' }}>
                  {tracks.length > 0 && currentIndex !== null && tracks.slice(currentIndex + 1, currentIndex + 1 + 20).length > 0 ? (
                    tracks.slice(currentIndex + 1, currentIndex + 1 + 20).map((t, i) => (
                      <li
                        key={i}
                        className="vp-track-item"
                        onClick={() => onSelectTrack?.(currentIndex + 1 + i)}
                      >
                        <span className="vp-track-num">+{i + 1}</span>
                        <span className="vp-track-name">{t.title || t.filename || 'Unknown Track'}</span>
                      </li>
                    ))
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', fontFamily: "'Doto', sans-serif", textAlign: 'center', margin: 'auto', padding: '20px' }}>
                      No upcoming tracks.
                    </div>
                  )}
                </ul>
              </div>
            ) : (
              <>
                {/* Audio Mixing Sliders Panel */}
                <div className="vp-digital-panel vp-sliders-container" style={{ height: '200px', flexShrink: 0 }}>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">SPD</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="0.8" max="1.2" step="0.01"
                        value={playbackRate} onChange={e => onPlaybackRateChange?.(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">BASS</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqLow ?? 0} onChange={e => onEffectChange?.('eqLow', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">MID</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqMid ?? 0} onChange={e => onEffectChange?.('eqMid', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">TRE</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqHigh ?? 0} onChange={e => onEffectChange?.('eqHigh', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Horizontal FX Sliders Panel */}
                <div className="vp-digital-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', width: '100%', height: '70px', flexShrink: 0, boxSizing: 'border-box' }}>
                  <div className="vp-fx-container">
                    <div className="vp-fx-group">
                      <span className="vp-fx-label">REV</span>
                      <div className="vp-slider-wrapper-hz">
                        <div className="vp-slider-ticks-hz" />
                        <input type="range" className="vp-slider-hz" min="0" max="1" step="0.1"
                          value={audioEffects.reverb ?? 0} onChange={e => onEffectChange?.('reverb', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="vp-fx-group">
                      <span className="vp-fx-label">DLY</span>
                      <div className="vp-slider-wrapper-hz">
                        <div className="vp-slider-ticks-hz" />
                        <input type="range" className="vp-slider-hz" min="0" max="1" step="0.1"
                          value={audioEffects.delay ?? 0} onChange={e => onEffectChange?.('delay', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status/Waveform Panel (Bottom) */}
                <div className="vp-digital-panel" style={{ flexDirection: 'column', gap: '16px', padding: '16px 20px', minHeight: '160px', flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    {/* Status readouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Status
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusPulse isPlaying={isPlaying} />
                        <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {isPlaying ? 'Playing' : 'Paused'}
                        </span>
                      </div>
                    </div>

                    {/* Track readouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Track
                      </div>
                      <div className="vp-digital-matrix" style={{ transform: 'none', gap: '4px', display: 'flex' }}>
                        {countDigits.map((digit, index) => (
                          <Matrix key={index} rows={7} cols={5} pattern={digits[digit]} size={5} gap={1.5} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="vp-digital-wave" style={{ width: '100%', height: '50px' }}>
                    <LiveWaveform
                      active={isPlaying} mode="scrolling" audioElement={audioElement} color="#ffffff" barWidth={2} barGap={2}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom memo comparator — skip re-render if ONLY currentTime changed.
// The LiveWaveform reads directly from the audio element node, so it
// doesn't need currentTime via React props. Everything else triggers a re-render.
export default memo(VinylPlayer, (prev, next) => {
  if (prev.isPlaying !== next.isPlaying) return false
  if (prev.coverUrl !== next.coverUrl) return false
  if (prev.audioElement !== next.audioElement) return false
  if (prev.trackNumber !== next.trackNumber) return false
  if (prev.songName !== next.songName) return false
  if (prev.albumName !== next.albumName) return false
  if (prev.artistName !== next.artistName) return false
  if (prev.albumTrackCount !== next.albumTrackCount) return false
  if (prev.durationSeconds !== next.durationSeconds) return false
  if (prev.volume !== next.volume) return false
  if (prev.playbackRate !== next.playbackRate) return false
  if (prev.audioEffects !== next.audioEffects) return false
  if (prev.lyrics !== next.lyrics) return false
  if (prev.className !== next.className) return false
  if (prev.tracks !== next.tracks) return false
  if (prev.currentIndex !== next.currentIndex) return false
  // Allow currentTime through only in coarse 250ms steps (for lyrics sync)
  // The comparator returning true means "props are equal, skip render"
  const timeDelta = Math.abs((prev.currentTime ?? 0) - (next.currentTime ?? 0))
  if (timeDelta >= 0.25) return false
  // All other callbacks — stable via useCallback in parent, so these are fine:
  // onVolumeChange, onPlaybackRateChange, onEffectChange, onResetDefaults,
  // onPrevAlbum, onNextAlbum, onTogglePlay, onSeek
  return true
})