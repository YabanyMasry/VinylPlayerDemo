import React from 'react'
import './StudioFooter.css'

/* ── helpers ─────────────────────────────────────────────────── */

function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

export default function StudioFooter({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  className = ''
}) {
  return (
    <footer className={`vp-footer-sleek ${className}`}>
      {/* left: track info */}
      <div className="vp-footer-info">
        <span className="vp-sleek-title">
          {currentTrack?.title || 'NO TRACK LOADED'}
        </span>
        <span className="vp-sleek-artist">
          {currentTrack?.artist || '—'}
        </span>
      </div>

      {/* center: controls + progress */}
      <div className="vp-footer-center">
        <div className="vp-footer-controls">
          <button
            type="button"
            className="vp-round-btn"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <button
            type="button"
            className="vp-round-btn vp-round-btn--play"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ marginLeft: '2px' }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            )}
          </button>

          <button
            type="button"
            className="vp-round-btn"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div className="vp-footer-progress-row">
          <span className="vp-sleek-time">{formatTime(currentTime)}</span>
          <div className="vp-sleek-groove-wrapper">
            <input
              type="range"
              className="vp-sleek-fader"
              min={0}
              max={duration || 0}
              step={0.25}
              value={currentTime}
              onChange={e => onSeek(Number(e.target.value))}
              disabled={!duration}
              aria-label="Seek"
            />
          </div>
          <span className="vp-sleek-time">{formatTime(duration)}</span>
        </div>
      </div>

      {/* right: volume */}
      <div className="vp-footer-volume">
        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <div className="vp-sleek-groove-wrapper">
          <input
            type="range"
            className="vp-sleek-fader"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => onVolumeChange(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  )
}
