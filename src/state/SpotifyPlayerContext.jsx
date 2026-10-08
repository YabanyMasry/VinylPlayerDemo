import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PlayerContext } from './PlayerContext'

/**
 * SpotifyPlayerProvider
 * 
 * Implements the unified player interface backed by:
 *   - Spotify Web Playback SDK (in-browser streaming)
 *   - Spotify Web API (library, playlists, metadata)
 * 
 * Requirements: Spotify Premium, HTTPS in production
 */

const SPOTIFY_SDK_URL = 'https://sdk.scdn.co/spotify-player.js'

function parseLrcText(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!timestamps.length) continue;
    const lyricText = line.replace(/\[[^\]]+\]/g, '').trim();
    for (const stamp of timestamps) {
      const min = Number.parseInt(stamp[1], 10);
      const sec = Number.parseInt(stamp[2], 10);
      const fractionRaw = stamp[3] ?? '0';
      const fraction = Number.parseInt(fractionRaw.padEnd(3, '0').slice(0, 3), 10);
      const time = min * 60 + sec + fraction / 1000;
      rows.push({ time, text: lyricText || '...' });
    }
  }
  rows.sort((a, b) => a.time - b.time);
  return rows;
}

export function SpotifyPlayerProvider({ children }) {
  // -- Core playback state --
  const [tracks, setTracks] = useState([])
  const [globalTracks, setGlobalTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  // -- Library state --
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [activePlaylist, setActivePlaylist] = useState(null)

  // -- Spotify state --
  const [spotifyUser, setSpotifyUser] = useState(null)
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null)
  const [isSDKReady, setIsSDKReady] = useState(false)
  const [accessToken, setAccessToken] = useState(null)

  const playerRef = useRef(null)
  const positionIntervalRef = useRef(null)

  // -- Effects stubs (no-ops in Spotify mode) --
  const [audioEffects, setAudioEffects] = useState({
    eqHigh: 0, eqMid: 0, eqLow: 0,
    distortion: 0, reverb: 0, vinylCrackle: 0,
    pitchShift: 0, chorus: 0, phaser: 0,
    bitCrusher: 0, delay: 0,
    djFilter: 0, autoWah: 0, stereoWidth: 0.5,
    autoPan: 0, wowFlutter: 0, tapeSaturation: 0, sidechainPump: 0,
  })

  // --------------------------------------------------------
  // 1. Token Fetching
  // --------------------------------------------------------
  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/token')
      if (!res.ok) return null
      const data = await res.json()
      setAccessToken(data.access_token)
      return data.access_token
    } catch {
      return null
    }
  }, [])

  // --------------------------------------------------------
  // 2. Load Web Playback SDK
  // --------------------------------------------------------
  useEffect(() => {
    // If SDK already loaded (cached/fast load), mark ready immediately
    if (window.Spotify?.Player) {
      setIsSDKReady(true)
      return
    }

    // Always (re-)register the callback — the SDK checks for this global
    window.onSpotifyWebPlaybackSDKReady = () => {
      setIsSDKReady(true)
    }

    // Only inject the script tag once
    if (!document.querySelector(`script[src="${SPOTIFY_SDK_URL}"]`)) {
      const script = document.createElement('script')
      script.src = SPOTIFY_SDK_URL
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      delete window.onSpotifyWebPlaybackSDKReady
    }
  }, [])

  // --------------------------------------------------------
  // 3. Initialize Player when SDK is ready + we have a token
  // --------------------------------------------------------
  useEffect(() => {
    if (!isSDKReady) return

    let mounted = true

    const initPlayer = async () => {
      const token = await fetchToken()
      if (!token || !mounted) return

      const player = new window.Spotify.Player({
        name: 'Vinyl Player',
        getOAuthToken: async (cb) => {
          const freshToken = await fetchToken()
          cb(freshToken)
        },
        volume: volume,
      })

      // Error handling
      player.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify SDK] Init error:', message)
        setLibraryError(`Spotify SDK init failed: ${message}`)
      })
      let authRetries = 0
      player.addListener('authentication_error', async ({ message }) => {
        authRetries++
        if (authRetries > 2) {
          console.error('[Spotify SDK] Auth failed after retries. Scopes may be outdated — re-login required.')
          setLibraryError('Spotify token scopes are outdated. Please logout and re-login via Settings.')
          return
        }
        console.warn('[Spotify SDK] Auth error:', message, `— retry ${authRetries}/2...`)
        const freshToken = await fetchToken()
        if (freshToken) {
          player.disconnect()
          setTimeout(() => player.connect(), 1500)
        } else {
          setLibraryError('Spotify authentication failed. Please re-login via Settings.')
        }
      })
      player.addListener('account_error', ({ message }) => {
        console.error('[Spotify SDK] Account error:', message)
        setLibraryError('Spotify Premium is required for playback.')
      })

      // Ready
      player.addListener('ready', ({ device_id }) => {
        console.log('[Spotify SDK] Ready with Device ID:', device_id)
        setSpotifyDeviceId(device_id)
      })

      player.addListener('not_ready', ({ device_id }) => {
        console.log('[Spotify SDK] Device went offline:', device_id)
        setSpotifyDeviceId(null)
      })

      // State changes (real-time playback updates)
      player.addListener('player_state_changed', (state) => {
        if (!state) return

        const track = state.track_window.current_track
        setIsPlaying(!state.paused)
        setDuration(state.duration / 1000)
        setCurrentTime(state.position / 1000)

        // Update the current track info from Spotify's state
        if (track) {
          const spotifyTrack = {
            id: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            albumArtist: track.artists[0]?.name || 'Unknown Artist',
            coverUrl: track.album.images[0]?.url || null,
            spotifyUri: track.uri,
          }

          // Update current track in our tracks array
          setTracks(prev => {
            const idx = prev.findIndex(t => t.id === track.id || t.spotifyUri === track.uri)
            if (idx >= 0) {
              setCurrentIndex(idx)
              return prev
            }
            // Track not in our list — add it
            const next = [...prev, spotifyTrack]
            setCurrentIndex(next.length - 1)
            return next
          })
        }
      })

      await player.connect()
      playerRef.current = player
    }

    initPlayer()

    return () => {
      mounted = false
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
    }
  }, [isSDKReady, fetchToken])

  // --------------------------------------------------------
  // 4. Position polling (SDK doesn't fire continuous position events)
  // --------------------------------------------------------
  useEffect(() => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current)
    }

    if (isPlaying && playerRef.current) {
      positionIntervalRef.current = setInterval(async () => {
        const state = await playerRef.current?.getCurrentState()
        if (state) {
          setCurrentTime(state.position / 1000)
        }
      }, 500)
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current)
      }
    }
  }, [isPlaying])

  // --------------------------------------------------------
  // 4b. Fetch Lyrics from lrclib.net
  // --------------------------------------------------------
  useEffect(() => {
    if (currentIndex === null || !tracks[currentIndex]) return;
    
    const track = tracks[currentIndex];
    // If we already fetched or attempted to fetch lyrics, don't do it again
    if (track.lyrics !== undefined) return;

    let isSubscribed = true;

    async function fetchLyrics() {
      try {
        const url = new URL('https://lrclib.net/api/get');
        url.searchParams.append('track_name', track.title);
        url.searchParams.append('artist_name', track.artist);
        if (track.album && track.album !== 'Unknown Album') {
          url.searchParams.append('album_name', track.album);
        }

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Lyrics not found');
        const data = await res.json();
        
        if (isSubscribed) {
          const lyricsRows = data?.syncedLyrics ? parseLrcText(data.syncedLyrics) : [];
          setTracks(prev => {
             const newTracks = [...prev];
             // Make sure we are updating the SAME track we fetched for, in case currentIndex changed
             const idx = newTracks.findIndex(t => t.id === track.id && t.spotifyUri === track.spotifyUri);
             if (idx !== -1) {
               newTracks[idx] = { ...newTracks[idx], lyrics: lyricsRows };
             }
             return newTracks;
          });
        }
      } catch (err) {
        if (isSubscribed) {
           console.log(`[Spotify Lyrics] ${err.message} for ${track.title}`);
           setTracks(prev => {
             const newTracks = [...prev];
             const idx = newTracks.findIndex(t => t.id === track.id && t.spotifyUri === track.spotifyUri);
             if (idx !== -1) {
               newTracks[idx] = { ...newTracks[idx], lyrics: [] };
             }
             return newTracks;
           });
        }
      }
    }
    
    fetchLyrics();

    return () => {
      isSubscribed = false;
    };
  }, [currentIndex, tracks]);

  // --------------------------------------------------------
  // 5. Fetch user profile
  // --------------------------------------------------------
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSpotifyUser(data) })
      .catch(() => {})
  }, [accessToken])

  // --------------------------------------------------------
  // 6. Library fetching (Spotify saved albums → albums array)
  // --------------------------------------------------------
  const fetchSpotifyLibrary = useCallback(async () => {
    setIsLoadingLibrary(true)
    setLibraryError('')

    try {
      const allTracks = []
      let offset = 0
      const limit = 50
      let total = Infinity

      // Fetch saved albums page by page
      while (offset < total) {
        const albumsRes = await fetch(`/api/auth/spotify/albums?limit=${limit}&offset=${offset}`)
        if (!albumsRes.ok) throw new Error('Failed to fetch Spotify albums')
        const albumsData = await albumsRes.json()

        total = albumsData.total || 0
        const items = albumsData.items || []
        
        if (items.length === 0) break

        for (const item of items) {
          const album = item.album
          if (!album) continue

          for (const track of (album.tracks?.items || [])) {
            allTracks.push({
              id: track.id,
              title: track.name,
              artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
              album: album.name,
              albumArtist: album.artists?.[0]?.name || 'Unknown Artist',
              coverUrl: album.images?.[0]?.url || null,
              trackNumber: track.track_number,
              discNumber: track.disc_number,
              spotifyUri: track.uri,
              albumUri: album.uri,
              filename: track.name, // compat
            })
          }
        }
        
        offset += limit;
      }

      setGlobalTracks(allTracks)
      setTracks(allTracks)
    } catch (err) {
      setLibraryError(err.message)
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [])

  const loadLibrary = useCallback(() => fetchSpotifyLibrary(), [fetchSpotifyLibrary])
  const refreshLibrary = useCallback(() => fetchSpotifyLibrary(), [fetchSpotifyLibrary])

  // Auto-load library on mount
  useEffect(() => {
    fetchSpotifyLibrary()
  }, [fetchSpotifyLibrary])

  // --------------------------------------------------------
  // 7. Playback controls
  // --------------------------------------------------------
  const playSpotifyUri = useCallback(async (uri, offset = 0) => {
    const token = await fetchToken()
    if (!token || !spotifyDeviceId) return

    const body = {}
    if (uri.includes(':album:') || uri.includes(':playlist:')) {
      body.context_uri = uri
      if (offset > 0) body.offset = { position: offset }
    } else if (uri.includes(':track:')) {
      body.uris = [uri]
    }

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }, [fetchToken, spotifyDeviceId])

  const selectTrack = useCallback(async (index) => {
    const track = tracks[index]
    if (!track) return
    setCurrentIndex(index)

    if (track.spotifyUri) {
      await playSpotifyUri(track.spotifyUri)
    }
  }, [tracks, playSpotifyUri])

  const playGlobalTrack = useCallback(async (index) => {
    setActivePlaylist(null)
    setTracks(globalTracks)
    const track = globalTracks[index]
    if (!track) return
    setCurrentIndex(index)

    if (track.spotifyUri) {
      await playSpotifyUri(track.spotifyUri)
    }
  }, [globalTracks, playSpotifyUri])

  const playAlbum = useCallback(async (albumName) => {
    setActivePlaylist(null)
    setTracks(globalTracks)

    const track = globalTracks.find(t => t.album === albumName)
    if (!track) return

    const idx = globalTracks.indexOf(track)
    setCurrentIndex(idx)

    if (track.albumUri) {
      await playSpotifyUri(track.albumUri)
    } else if (track.spotifyUri) {
      await playSpotifyUri(track.spotifyUri)
    }
  }, [globalTracks, playSpotifyUri])

  const loadPlaylist = useCallback(async (playlist) => {
    setActivePlaylist(playlist)

    if (playlist.spotifyUri) {
      // Spotify playlist — fetch tracks from API
      const id = playlist.spotifyUri.split(':').pop()
      try {
        const res = await fetch(`/api/auth/spotify/playlists/${id}/items?limit=100`)
        if (!res.ok) throw new Error('Failed to fetch playlist tracks')
        const data = await res.json()

        const playlistTracks = (data.items || [])
          .filter(item => item?.track)
          .map(item => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists?.map(a => a.name).join(', ') || 'Unknown',
            album: item.track.album?.name || 'Unknown Album',
            albumArtist: item.track.album?.artists?.[0]?.name || 'Unknown',
            coverUrl: item.track.album?.images?.[0]?.url || null,
            trackNumber: item.track.track_number,
            spotifyUri: item.track.uri,
            filename: item.track.name,
          }))

        setTracks(playlistTracks)
        if (playlistTracks.length > 0) {
          setCurrentIndex(0)
          await playSpotifyUri(playlist.spotifyUri)
        }
      } catch (err) {
        console.error('Failed to load Spotify playlist:', err)
      }
    } else if (playlist.tracks) {
      // Local-style playlist object
      const nextTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
      setTracks(nextTracks)
      if (nextTracks.length > 0) {
        setCurrentIndex(0)
        setIsPlaying(true)
      }
    }
  }, [playSpotifyUri])

  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.togglePlay()
  }, [])

  const prevTrack = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.previousTrack()
  }, [])

  const nextTrack = useCallback(async () => {
    if (!playerRef.current) return
    await playerRef.current.nextTrack()
  }, [])

  const seek = useCallback(async (seconds) => {
    if (!playerRef.current) return
    await playerRef.current.seek(seconds * 1000)
    setCurrentTime(seconds)
  }, [])

  const setVolumeHandler = useCallback(async (vol) => {
    if (playerRef.current) {
      await playerRef.current.setVolume(vol)
    }
  }, [])

  // No-ops for Spotify mode
  const handleResetDefaults = useCallback(() => {}, [])
  const triggerTapeStop = useCallback(() => {}, [])
  const setPlaybackRate = useCallback(() => {}, [])

  // --------------------------------------------------------
  // 8. Albums derivation (same logic as local, from globalTracks)
  // --------------------------------------------------------
  const albums = useMemo(() => {
    const byAlbum = new Map()

    for (let i = 0; i < globalTracks.length; i++) {
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
          spotifyUri: track.albumUri || null,
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
        return aNum - bNum
      })
    }

    return Array.from(byAlbum.values()).sort((a, b) => a.album.localeCompare(b.album))
  }, [globalTracks])

  // --------------------------------------------------------
  // 9. Context value
  // --------------------------------------------------------
  const value = useMemo(() => ({
    audioRef: { current: null }, // No audio element in Spotify mode
    tracks,
    albums,
    activePlaylist,
    currentIndex,
    currentTrack: currentIndex !== null ? tracks[currentIndex] : null,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate: 1,
    hasPrev: currentIndex !== null && currentIndex > 0,
    hasNext: currentIndex !== null && currentIndex < tracks.length - 1,
    libraryPath: 'Spotify Library',
    isLoadingLibrary,
    libraryError,
    loadLibrary,
    refreshLibrary,
    loadPlaylist,
    selectTrack,
    playGlobalTrack,
    playAlbum,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume: setVolumeHandler,
    setPlaybackRate,
    handleResetDefaults,
    audioEffects,
    setAudioEffects,
    triggerTapeStop,
    mode: 'spotify',
    spotifyUser,
    spotifyDeviceId,
  }), [
    tracks, albums, activePlaylist, currentIndex, isPlaying, currentTime, duration,
    volume, isLoadingLibrary, libraryError, audioEffects, spotifyUser, spotifyDeviceId,
    loadLibrary, refreshLibrary, loadPlaylist, selectTrack, playGlobalTrack, playAlbum,
    togglePlay, prevTrack, nextTrack, seek, setVolumeHandler, handleResetDefaults, triggerTapeStop,
  ])

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}
