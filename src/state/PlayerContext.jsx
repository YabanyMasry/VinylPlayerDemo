import { createContext, useContext } from 'react'

/**
 * Unified Player Context
 * 
 * This context provides a single API shape consumed by all pages/components.
 * Two providers implement this interface:
 *   - LocalPlayerProvider  (dev mode — local filesystem + Tone.js)
 *   - SpotifyPlayerProvider (prod mode — Spotify Web Playback SDK)
 * 
 * Shared interface shape:
 * {
 *   // Track data
 *   tracks, albums, activePlaylist, currentTrack, currentIndex,
 *   // Playback state
 *   isPlaying, currentTime, duration, volume, playbackRate,
 *   hasPrev, hasNext,
 *   // Library
 *   libraryPath, isLoadingLibrary, libraryError,
 *   // Actions
 *   loadLibrary, refreshLibrary, loadPlaylist, selectTrack,
 *   playGlobalTrack, playAlbum, togglePlay, prevTrack, nextTrack,
 *   seek, setVolume, setPlaybackRate,
 *   // Effects (local only — no-ops in Spotify mode)
 *   audioEffects, setAudioEffects, handleResetDefaults,
 *   // Mode
 *   mode: 'local' | 'spotify',
 *   // Spotify-specific (null in local mode)
 *   spotifyUser, spotifyDeviceId
 * }
 */

export const PlayerContext = createContext(null)

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used inside a PlayerProvider (LocalPlayerProvider or SpotifyPlayerProvider)')
  }
  return context
}
