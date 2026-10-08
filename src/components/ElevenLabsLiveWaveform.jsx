import React, { useEffect, useRef, useState } from 'react'
import './ElevenLabsLiveWaveform.css'

export function LiveWaveform({
  active = false,
  amplitude = 1,
  barWidth = 3,
  barGap = 4,
  maxBarHeight = 1,
  minBarHeight = 1.5,
  color = 'rgba(255, 255, 255, 0.8)',
  mirror = true,
  fftSize = 128,          // Reduced from 256 — halves the analysis buffer (still sounds great)
  maxFps = 30,
  mode = 'static',
  audioElement,
  onError,
  onStream,
  onStop
}) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)

  // Audio references
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const dataArrayRef = useRef(null)
  const animationFrameRef = useRef(null)

  // Scrolling mode history
  const historyRef = useRef([])
  const lastDrawAtRef = useRef(0)

  // Resize canvas handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Setup / Teardown audio + drawing loop — all in ONE effect so draw() is
  // never a zombie: the RAF is always cancelled in the same cleanup that tears
  // down the audio context it was reading from.
  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (audioContextRef.current && !audioElement) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      historyRef.current = []
      lastDrawAtRef.current = 0
      if (onStop) onStop()
      return
    }

    let isMounted = true

    // ── drawing loop (declared here so it closes over the refs set up below) ──
    const draw = () => {
      if (!isMounted) return

      const canvas = canvasRef.current
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const now = performance.now()
      const hidden = typeof document !== 'undefined' && document.hidden
      // Slow down significantly when tab is in background
      const visibleFps = Math.max(12, Math.min(60, Number(maxFps) || 30))
      const hiddenFps = Math.max(4, Math.floor(visibleFps / 5))
      const minDelta = 1000 / (hidden ? hiddenFps : visibleFps)
      if (now - lastDrawAtRef.current < minDelta) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastDrawAtRef.current = now

      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)

      if (!audioElement && !streamRef.current) {
        drawLoadingState(ctx, width, height)
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      if (!analyserRef.current || !dataArrayRef.current) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current)

      if (mode === 'static') {
        drawStatic(ctx, width, height)
      } else {
        drawScrolling(ctx, width, height)
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    // ── helper draw functions capture closure vars only (no shifting refs) ──
    const drawStatic = (ctx, width, height) => {
      const data = dataArrayRef.current
      const totalBars = Math.floor(width / (barWidth + barGap))
      const step = Math.max(1, Math.floor(data.length / (totalBars / 2)))
      const center = width / 2

      ctx.fillStyle = color
      ctx.beginPath()

      for (let i = 0; i < totalBars / 2; i++) {
        const idx = Math.floor(i * step)
        const val = data[idx] || 0
        const pct = val / 255
        const h = Math.max(minBarHeight, (pct * height * maxBarHeight * amplitude))
        const x = center - (i * (barWidth + barGap)) - barWidth
        const y = (height - h) / 2
        ctx.roundRect(x, y, barWidth, h, 2)
      }
      for (let i = 0; i < totalBars / 2; i++) {
        const idx = Math.floor(i * step)
        const val = data[idx] || 0
        const pct = val / 255
        const h = Math.max(minBarHeight, (pct * height * maxBarHeight * amplitude))
        const x = center + (i * (barWidth + barGap))
        const y = (height - h) / 2
        ctx.roundRect(x, y, barWidth, h, 2)
      }
      ctx.fill()
    }

    const drawScrolling = (ctx, width, height) => {
      const data = dataArrayRef.current
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length
      const pct = avg / 255

      historyRef.current.unshift(pct)
      const maxBars = Math.ceil(width / (barWidth + barGap))
      if (historyRef.current.length > maxBars) historyRef.current.pop()

      ctx.fillStyle = color
      ctx.beginPath()
      for (let i = 0; i < historyRef.current.length; i++) {
        const pointPct = historyRef.current[i]
        const h = Math.max(minBarHeight, (pointPct * height * maxBarHeight * amplitude * 2))
        const x = width - (i * (barWidth + barGap)) - barWidth
        const y = (height - h) / 2
        ctx.roundRect(x, y, barWidth, h, 2)
      }
      ctx.fill()
    }

    const drawLoadingState = (ctx, width, height) => {
      const time = Date.now() / 300
      const totalBars = Math.floor(width / (barWidth + barGap))
      const center = width / 2

      ctx.fillStyle = color
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      for (let i = 0; i < totalBars / 2; i++) {
        const wave = Math.sin(time + i * 0.5) * 0.5 + 0.5
        const h = Math.max(minBarHeight, (wave * height * 0.3))
        ctx.roundRect(center - (i * (barWidth + barGap)) - barWidth, (height - h) / 2, barWidth, h, 2)
      }
      for (let i = 0; i < totalBars / 2; i++) {
        const wave = Math.sin(time + i * 0.5) * 0.5 + 0.5
        const h = Math.max(minBarHeight, (wave * height * 0.3))
        ctx.roundRect(center + (i * (barWidth + barGap)), (height - h) / 2, barWidth, h, 2)
      }
      ctx.fill()
      ctx.globalAlpha = 1.0
    }

    // ── audio init ──
    async function initAudio() {
      try {
        if (audioElement) {
          if (!audioElement._audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            audioElement._audioContext = new AudioContext()
            audioElement.crossOrigin = 'anonymous'
            audioElement._waveformSource = audioElement._audioContext.createMediaElementSource(audioElement)
          }

          const ctx = audioElement._audioContext
          audioContextRef.current = ctx

          if (ctx.state === 'suspended') await ctx.resume()

          const analyser = ctx.createAnalyser()
          analyser.fftSize = fftSize
          analyser.smoothingTimeConstant = 0.8
          analyserRef.current = analyser

          const source = audioElement._waveformSource
          if (audioElement._tapNode) {
            audioElement._tapNode.connect(analyser)
          } else {
            source.disconnect()
            source.connect(analyser)
            analyser.connect(ctx.destination)
          }
          sourceRef.current = source

          dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
          if (isMounted) draw()
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (onStream) onStream(stream)

        const AudioContext = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioContext()
        audioContextRef.current = ctx

        const analyser = ctx.createAnalyser()
        analyser.fftSize = fftSize
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        sourceRef.current = source

        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
        if (isMounted) draw()
      } catch (err) {
        console.error('Audio hook error:', err)
        setError(err.message)
        if (onError) onError(err)
      }
    }

    initAudio()

    return () => {
      isMounted = false
      // Cancel RAF before any other cleanup so the draw loop doesn't fire on stale refs
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current && !audioElement) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
      dataArrayRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fftSize, audioElement])

  if (error) {
    return (
      <div className="el-live-waveform-error">
        Mic error: {error}
      </div>
    )
  }

  return (
    <div className="el-live-waveform-wrapper">
      <canvas ref={canvasRef} className="el-live-waveform-canvas" />
    </div>
  )
}
