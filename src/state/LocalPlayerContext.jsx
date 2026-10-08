import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import { PlayerContext, usePlayer } from './PlayerContext'

export function LocalPlayerProvider({ children }) {
  const [globalTracks, setGlobalTracks] = useState([])
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [libraryPath, setLibraryPath] = useState('')
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [activePlaylist, setActivePlaylist] = useState(null)

  const [audioEffects, setAudioEffects] = useState({
    eqHigh: 0,
    eqMid: 0,
    eqLow: 0,
    distortion: 0,
    reverb: 0,
    vinylCrackle: 0,
    pitchShift: 0,
    chorus: 0,
    phaser: 0,
    bitCrusher: 0,
    delay: 0,
    djFilter: 0,
    autoWah: 0,
    stereoWidth: 0.5,
    autoPan: 0,
    wowFlutter: 0,
    tapeSaturation: 0,
    sidechainPump: 0,
  })

  const audioRef = useRef(null)
  const toneNodesRef = useRef(null)
  const lastTimeEmitRef = useRef({ time: -1, ms: 0 })

  const currentTrackUrl = currentIndex !== null ? tracks[currentIndex]?.url || null : null

  // --------------------------------------------------------
  // 1. Core Audio Event Listeners
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const nextTime = audio.currentTime
      const now = performance.now()
      const nearEnd = Number.isFinite(audio.duration) && audio.duration > 0 && (audio.duration - nextTime) < 0.12
      const elapsedMs = now - lastTimeEmitRef.current.ms
      const deltaTime = Math.abs(nextTime - lastTimeEmitRef.current.time)

      if (!nearEnd && elapsedMs < 90 && deltaTime < 0.08) return

      lastTimeEmitRef.current = { time: nextTime, ms: now }
      setCurrentTime(nextTime)
    }
    const onDurationChange = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => {
      setCurrentIndex(prev => {
        if (prev !== null && prev < tracks.length - 1) return prev + 1
        setIsPlaying(false)
        return prev
      })
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [tracks.length])

  // --------------------------------------------------------
  // 2. Track Source Management
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    const currentUrl = tracks[currentIndex]?.url
    if (currentUrl && audio.src !== new URL(currentUrl, window.location.origin).toString()) {
      audio.src = currentUrl
      lastTimeEmitRef.current = { time: 0, ms: performance.now() }
      setCurrentTime(0)
      setDuration(0)
    }
  }, [currentIndex, tracks])

  // --------------------------------------------------------
  // 3. Playback Control
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    let cancelled = false

    if (!isPlaying) {
      audio.pause()
      return () => {
        cancelled = true
      }
    }

    const playWithRetry = async () => {
      try {
        if (Tone.context.state !== 'running') {
          await Tone.start()
        }
        await audio.play()
      } catch {
        // Some browsers need one deferred retry even after audio context resume.
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (cancelled) return

        try {
          if (Tone.context.state !== 'running') {
            await Tone.start()
          }
          await audio.play()
        } catch (retryErr) {
          if (cancelled) return
          console.warn("Playback prevented by browser:", retryErr)
          setIsPlaying(false)
        }
      }
    }

    playWithRetry()

    return () => {
      cancelled = true
    }
  }, [isPlaying, currentIndex, currentTrackUrl])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // --------------------------------------------------------
  // 4. Tone.js Initialization & Master Chain (TRUE BYPASS FIX)
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio._hasToneAttached) {
      audio._hasToneAttached = true
      audio.crossOrigin = 'anonymous'

      const rawCtx = new (window.AudioContext || window.webkitAudioContext)()
      audio._audioContext = rawCtx

      Tone.setContext(new Tone.Context(rawCtx))

      const rawSource = rawCtx.createMediaElementSource(audio)
      audio._waveformSource = rawSource

      // EVERY effect is strictly initialized with wet.value = 0 (True Bypass)
      // so it physically does not process the audio unless activated.
      const eq = new Tone.EQ3(0, 0, 0)

      const dist = new Tone.Distortion(0)
      dist.wet.value = 0

      const pitch = new Tone.PitchShift(0)
      pitch.wet.value = 0

      const chorus = new Tone.Chorus(4, 2.5, 0).start()
      chorus.wet.value = 0

      const phaser = new Tone.Phaser({ frequency: 15, octaves: 5, baseFrequency: 1000 })
      phaser.wet.value = 0

      const bitCrusher = new Tone.BitCrusher(4)
      bitCrusher.wet.value = 0

      const delay = new Tone.FeedbackDelay("8n", 0.5)
      delay.wet.value = 0

      const widener = new Tone.StereoWidener(1)
      widener.wet.value = 0 // Bypassed by default

      const autoPanner = new Tone.AutoPanner("4n").start()
      autoPanner.wet.value = 0

      const sidechain = new Tone.Tremolo("4n", 1).start()
      sidechain.type = "sine"
      sidechain.wet.value = 0

      const autoWah = new Tone.AutoWah(50, 6, -30)
      autoWah.Q.value = 6
      autoWah.wet.value = 0

      // A 20kHz filter still causes phase shift. We set Q to 0 and push it to 22kHz to make it invisible.
      const djFilter = new Tone.Filter(22000, "lowpass", -12)
      djFilter.Q.value = 0

      const vibrato = new Tone.Vibrato(1.5, 0)
      vibrato.wet.value = 0

      const saturation = new Tone.Chebyshev(50)
      saturation.wet.value = 0

      // FIXED: Limiter was set to -1dB, squashing the raw audio. Now set to 0dB.
      const limiter = new Tone.Limiter(0)

      // Independent Noise Engine
      const vinylHiss = new Tone.Noise("pink").start()
      const hissFilter = new Tone.Filter(3500, "lowpass")
      const crackleGain = new Tone.Gain(0)
      vinylHiss.chain(hissFilter, crackleGain, limiter)

      const rev = new Tone.Reverb({ decay: 2.5, wet: 0 })
      rev.generate().catch(() => { })

      // Build Graph
      Tone.connect(rawSource, widener)
      widener.chain(
        autoPanner, sidechain, autoWah, djFilter, vibrato,
        eq, saturation, pitch, chorus, phaser, bitCrusher, dist,
        delay, rev, limiter
      )

      limiter.toDestination()
      audio._tapNode = limiter

      toneNodesRef.current = {
        eq, pitch, chorus, phaser, bitCrusher, dist, delay, rev, limiter, crackleGain,
        widener, autoPanner, sidechain, autoWah, djFilter, vibrato, saturation
      }
    }

    // --- REAL-TIME EFFECT ROUTING ---
    if (toneNodesRef.current) {
      const nodes = toneNodesRef.current

      // EQ (Since EQ3 has no wet property, it runs purely on the value)
      nodes.eq.high.value = audioEffects.eqHigh
      nodes.eq.mid.value = audioEffects.eqMid
      nodes.eq.low.value = audioEffects.eqLow

      // Distortion
      nodes.dist.distortion = audioEffects.distortion
      nodes.dist.wet.value = audioEffects.distortion > 0 ? 1 : 0 // True Bypass if 0

      // Reverb & Crackle
      nodes.rev.wet.value = audioEffects.reverb
      nodes.crackleGain.gain.value = audioEffects.vinylCrackle * 0.05

      // Pitch
      nodes.pitch.pitch = audioEffects.pitchShift
      nodes.pitch.wet.value = audioEffects.pitchShift !== 0 ? 1 : 0 // True Bypass if 0

      // Delay
      nodes.delay.wet.value = audioEffects.delay

      // Modulation
      nodes.chorus.wet.value = audioEffects.chorus
      nodes.phaser.wet.value = audioEffects.phaser

      // Bitcrusher
      nodes.bitCrusher.bits.value = Math.max(1, 8 - Math.round(audioEffects.bitCrusher * 7))
      nodes.bitCrusher.wet.value = audioEffects.bitCrusher > 0 ? 1 : 0 // True Bypass if 0

      // Stereo Imaging
      if (audioEffects.stereoWidth === 0.5) {
        nodes.widener.wet.value = 0 // True Bypass if normal
      } else {
        nodes.widener.wet.value = 1
        nodes.widener.width.value = audioEffects.stereoWidth * 2
      }

      nodes.autoPanner.wet.value = audioEffects.autoPan

      // Dynamics & Tape Emulation
      nodes.sidechain.wet.value = audioEffects.sidechainPump
      nodes.autoWah.wet.value = audioEffects.autoWah

      nodes.vibrato.depth.value = audioEffects.wowFlutter
      nodes.vibrato.wet.value = audioEffects.wowFlutter > 0 ? 1 : 0 // True Bypass if 0

      nodes.saturation.wet.value = audioEffects.tapeSaturation

      // 1-Knob DJ Filter Logic
      const filterVal = audioEffects.djFilter
      const minLog = Math.log10(20)
      const maxLog = Math.log10(20000)

      if (filterVal < 0) {
        nodes.djFilter.type = "lowpass"
        nodes.djFilter.frequency.value = Math.pow(10, maxLog - Math.abs(filterVal) * (maxLog - minLog))
      } else if (filterVal > 0) {
        nodes.djFilter.type = "highpass"
        nodes.djFilter.frequency.value = Math.pow(10, minLog + filterVal * (maxLog - minLog))
      } else {
        // Flat Bypass settings so it doesn't color the highs
        nodes.djFilter.type = "lowpass"
        nodes.djFilter.frequency.value = 22000
      }
    }
  }, [audioEffects])


  // --------------------------------------------------------
  // 5. Native DJ Performance Actions
  // --------------------------------------------------------
  const triggerTapeStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    const startRate = audio.playbackRate;
    const durationMs = 1500;
    const startTime = performance.now();

    const animateStop = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      audio.playbackRate = Math.max(startRate * (1 - easeProgress), 0.01);

      if (progress < 1) {
        requestAnimationFrame(animateStop);
      } else {
        audio.pause();
        setIsPlaying(false);
        audio.playbackRate = playbackRate;
      }
    };
    requestAnimationFrame(animateStop);
  }, [isPlaying, playbackRate]);


  // --------------------------------------------------------
  // 6. Library Fetching & Navigation
  // --------------------------------------------------------
  const hydrateLibrary = useCallback((payload) => {
    setActivePlaylist(null)
    const nextTracks = Array.isArray(payload?.tracks) ? payload.tracks : []
    setGlobalTracks(nextTracks)
    setTracks(nextTracks)
    setLibraryPath(payload?.rootPath || '')

    if (nextTracks.length === 0) {
      setCurrentIndex(null)
      setIsPlaying(false)
      return
    }

    setCurrentIndex(prev => {
      if (prev === null) return 0
      return Math.min(prev, nextTracks.length - 1)
    })
  }, [])

  const loadPlaylist = useCallback(async (playlist) => {
    setActivePlaylist(playlist)
    await ensureAudioContext()
    const nextTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
    setTracks(nextTracks)

    if (nextTracks.length === 0) {
      setCurrentIndex(null)
      setIsPlaying(false)
      return
    }

    setCurrentIndex(0)
    setIsPlaying(true)
  }, [])

  const fetchLibrary = useCallback(async (isRefresh = false) => {
    setIsLoadingLibrary(true)
    setLibraryError('')

    try {
      const endpoint = isRefresh ? '/api/library/refresh' : '/api/library'
      const options = isRefresh ? { method: 'POST' } : undefined

      const response = await fetch(endpoint, options)
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Library fetch failed (${response.status})`)
      }
      const payload = await response.json()
      hydrateLibrary(payload)
    } catch (error) {
      setLibraryError(String(error?.message || error))
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [hydrateLibrary])

  const loadLibrary = useCallback(() => fetchLibrary(false), [fetchLibrary])
  const refreshLibrary = useCallback(() => fetchLibrary(true), [fetchLibrary])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const ensureAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }
  }

  const selectTrack = useCallback(async (index) => {
    await ensureAudioContext()
    setCurrentIndex(index)
    setIsPlaying(true)
  }, [])

  const playGlobalTrack = useCallback(async (index) => {
    await ensureAudioContext()

    setTracks(prev => {
      if (prev !== globalTracks) return globalTracks;
      return prev;
    });
    setActivePlaylist(null);

    setCurrentIndex(index)
    setIsPlaying(true)
  }, [globalTracks])

  const playAlbum = useCallback(async (album) => {
    await ensureAudioContext()

    setTracks(prev => {
      // If we're not already playing from globalTracks, switch back
      if (prev !== globalTracks) return globalTracks;
      return prev;
    });
    setActivePlaylist(null);

    const idx = globalTracks.findIndex(t => t.album === album)
    if (idx >= 0) {
      setCurrentIndex(idx)
      setIsPlaying(true)
    }
  }, [globalTracks])

  const queueTrack = useCallback((track) => {
    if (!track) return
    setTracks(prev => [...prev, track])
  }, [])

  const queueTrackNext = useCallback((track) => {
    if (!track) return
    setTracks(prev => {
      if (currentIndex === null) return [track, ...prev]
      const insertAt = Math.min(currentIndex + 1, prev.length)
      return [...prev.slice(0, insertAt), track, ...prev.slice(insertAt)]
    })
  }, [currentIndex])

  const togglePlay = useCallback(async () => {
    await ensureAudioContext()
    if (currentIndex === null) {
      if (tracks.length > 0) {
        setCurrentIndex(0)
        setIsPlaying(true)
      }
      return
    }
    setIsPlaying(prev => !prev)
  }, [currentIndex, tracks.length])

  const prevTrack = useCallback(async () => {
    if (currentIndex === null) return
    await ensureAudioContext()

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsPlaying(true)
    }
  }, [currentIndex])

  const nextTrack = useCallback(async () => {
    if (currentIndex !== null && currentIndex < tracks.length - 1) {
      await ensureAudioContext()
      setCurrentIndex(currentIndex + 1)
      setIsPlaying(true)
    }
  }, [currentIndex, tracks.length])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.onMediaControl) return

    const unsubscribe = window.electronAPI.onMediaControl((action) => {
      if (action === 'play-pause') {
        togglePlay()
      } else if (action === 'next') {
        nextTrack()
      } else if (action === 'previous') {
        prevTrack()
      } else if (action === 'pause') {
        if (isPlaying) togglePlay()
      } else if (action === 'play') {
        if (!isPlaying) togglePlay()
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [togglePlay, nextTrack, prevTrack, isPlaying])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    const setHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Action may not be supported on all platforms.
      }
    }

    setHandler('play', () => {
      if (!isPlaying) togglePlay()
    })
    setHandler('pause', () => {
      if (isPlaying) togglePlay()
    })
    setHandler('previoustrack', () => {
      prevTrack()
    })
    setHandler('nexttrack', () => {
      nextTrack()
    })

    return () => {
      setHandler('play', null)
      setHandler('pause', null)
      setHandler('previoustrack', null)
      setHandler('nexttrack', null)
    }
  }, [togglePlay, prevTrack, nextTrack, isPlaying])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    const currentTrack = currentIndex !== null ? tracks[currentIndex] : null

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    } catch {
      // playbackState is optional in some environments.
    }

    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      return
    }

    const artwork = []
    if (currentTrack.coverUrl) {
      artwork.push({ src: currentTrack.coverUrl })
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || currentTrack.filename || 'Unknown Track',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'Unknown Album',
        artwork,
      })
    } catch {
      // MediaMetadata may be unavailable depending on platform.
    }
  }, [currentIndex, tracks, isPlaying])

  const handleResetDefaults = useCallback(() => {
    setPlaybackRate(1);
    setAudioEffects({
      eqHigh: 0, eqMid: 0, eqLow: 0,
      distortion: 0, reverb: 0, vinylCrackle: 0,
      pitchShift: 0, chorus: 0, phaser: 0,
      bitCrusher: 0, delay: 0,
      djFilter: 0, autoWah: 0, stereoWidth: 0.5,
      autoPan: 0, wowFlutter: 0, tapeSaturation: 0, sidechainPump: 0
    });
  }, []);

  const seek = useCallback((seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds
      lastTimeEmitRef.current = { time: seconds, ms: performance.now() }
      setCurrentTime(seconds)
    }
  }, [])

  const albums = useMemo(() => {
    const byAlbum = new Map()

    for (let i = 0; i < globalTracks.length; i += 1) {
      const track = globalTracks[i]
      const albumArtist = track.albumArtist || track.artist || 'Unknown Artist'
      const key = `${albumArtist}__${track.album}`

      if (!byAlbum.has(key)) {
        byAlbum.set(key, {
          key,
          album: track.album,
          artist: albumArtist,
          coverUrl: track.coverUrl || null,
          tracks: [],
        })
      }

      if (!byAlbum.get(key).coverUrl && track.coverUrl) {
        byAlbum.get(key).coverUrl = track.coverUrl
      }

      byAlbum.get(key).tracks.push({ ...track, index: i })
    }

    for (const album of byAlbum.values()) {
      album.tracks.sort((a, b) => {
        const aDisc = a.discNumber || 1
        const bDisc = b.discNumber || 1
        if (aDisc !== bDisc) return aDisc - bDisc

        const aNum = Number.isFinite(a.trackNumber) ? a.trackNumber : Number.MAX_SAFE_INTEGER
        const bNum = Number.isFinite(b.trackNumber) ? b.trackNumber : Number.MAX_SAFE_INTEGER
        if (aNum !== bNum) return aNum - bNum
        return a.filename.localeCompare(b.filename)
      })

      const discsMap = new Map()
      for (const t of album.tracks) {
        const d = t.discNumber || 1
        if (!discsMap.has(d)) discsMap.set(d, [])
        discsMap.get(d).push(t)
      }
      album.discs = Array.from(discsMap.entries()).map(([discNumber, discTracks]) => ({ discNumber, tracks: discTracks }))
    }

    return Array.from(byAlbum.values()).sort((a, b) => a.album.localeCompare(b.album))
  }, [globalTracks])

  // --------------------------------------------------------
  // 7. Context Provider Export
  // --------------------------------------------------------
  const value = useMemo(() => ({
    audioRef,
    tracks,
    albums,
    activePlaylist,
    currentIndex,
    currentTrack: currentIndex !== null ? tracks[currentIndex] : null,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    hasPrev: currentIndex !== null && currentIndex > 0,
    hasNext: currentIndex !== null && currentIndex < tracks.length - 1,
    libraryPath,
    isLoadingLibrary,
    libraryError,
    loadLibrary,
    refreshLibrary,
    loadPlaylist,
    selectTrack,
    playGlobalTrack,
    playAlbum,
    queueTrack,
    queueTrackNext,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    setPlaybackRate,
    handleResetDefaults,
    audioEffects,
    setAudioEffects,
    triggerTapeStop,
    mode: 'local',
    spotifyUser: null,
    spotifyDeviceId: null,
  }), [
    tracks, albums, activePlaylist, currentIndex, isPlaying, currentTime, duration,
    volume, playbackRate, libraryPath, isLoadingLibrary, libraryError, audioEffects,
    loadLibrary, refreshLibrary, loadPlaylist, selectTrack, playGlobalTrack, playAlbum, queueTrack, queueTrackNext, togglePlay, prevTrack, nextTrack, handleResetDefaults, seek, triggerTapeStop
  ])

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audioRef} crossOrigin="anonymous" />
      {children}
    </PlayerContext.Provider>
  )
}

// Backward-compat alias — use usePlayer() in new code
export const useLocalPlayer = usePlayer
