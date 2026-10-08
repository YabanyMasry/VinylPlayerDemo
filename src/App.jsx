import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { usePlayer } from './state/PlayerContext'
import StudioNav from './components/StudioNav'
import AlbumsPage from './pages/AlbumsPage'
import VinylPlayerPage from './pages/VinylPlayerPage'
import PlaylistsPage from './pages/PlaylistsPage'
import SettingsPage from './pages/SettingsPage'
import playerLogo from './assets/Flogo.png'
import './App.css'

const navItems = [
  { href: '/albums', label: 'Albums' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/vinyl-player', label: 'Vinyl' },
  { href: '/settings', label: 'Settings' },
]

export default function App() {
  const { libraryPath, isLoadingLibrary, libraryError, refreshLibrary, mode } = usePlayer()
  const location = useLocation()

  return (
<div className="app">
  <StudioNav 
    items={navItems}
    activeHref={location.pathname}
    className="app-pill-nav"
  />

  <Routes>
    <Route path="/" element={<Navigate to="/albums" replace />} />
    <Route path="/albums" element={<AlbumsPage />} />
    <Route path="/playlists" element={<PlaylistsPage />} />
    <Route path="/vinyl-player" element={<VinylPlayerPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>


      <footer className="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {mode === 'spotify'
            ? (libraryError ? `Spotify error: ${libraryError}` : 'Connected to Spotify')
            : (libraryError
              ? `Library error: ${libraryError}`
              : libraryPath
                ? `Library: ${libraryPath}`
                : 'Waiting for backend library scan...')}
        </div>
        {mode === 'local' && (
        <button type="button" className="primary" onClick={refreshLibrary} disabled={isLoadingLibrary} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>
          {isLoadingLibrary ? 'Refreshing...' : 'Refresh'}
        </button>
        )}
      </footer>
    </div>
  )
}
