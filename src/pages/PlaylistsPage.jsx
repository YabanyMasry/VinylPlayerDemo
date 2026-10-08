import React, { useState, useEffect } from 'react';
import { usePlayer } from '../state/PlayerContext';
import TrackContextMenu from '../components/TrackContextMenu';
import './PlaylistsPage.css';

export default function PlaylistsPage() {
  const { loadPlaylist, selectTrack, queueTrack, queueTrackNext } = usePlayer();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [menuBusy, setMenuBusy] = useState(false);

  // Spotify Import State
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [importStatus, setImportStatus] = useState({ loading: false, message: 'AWAITING SYNC...', type: 'idle' });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [missingAlbums, setMissingAlbums] = useState([]);
  const [expandedAlbums, setExpandedAlbums] = useState({});

  // Custom Playlist State
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Track right-click context menu
  const [trackMenu, setTrackMenu] = useState(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkImportConnection = async () => {
      if (!mounted) return;

      if (!navigator.onLine) {
        setConnectionStatus('disconnected');
        return;
      }

      setConnectionStatus('checking');
      try {
        const response = await fetch('/api/playlists/import-status', { cache: 'no-store' });
        if (!mounted) return;
        setConnectionStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        if (!mounted) return;
        setConnectionStatus('disconnected');
      }
    };

    const onOnline = () => checkImportConnection();
    const onOffline = () => setConnectionStatus('disconnected');

    checkImportConnection();
    const intervalId = window.setInterval(checkImportConnection, 20000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!trackMenu) return;

    const closeMenu = () => setTrackMenu(null);
    const onEscape = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', onEscape);
    };
  }, [trackMenu]);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error('Failed to fetch playlists');
      const data = await response.json();
      setPlaylists(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(playlist.filename)}`);
      if (!response.ok) throw new Error('Failed to load playlist tracks');
      const data = await response.json();
      setSelectedPlaylist({ ...data, filename: playlist.filename });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrackPayload = (track) => ({
    absolutePath: track?.absolutePath || null,
    relativePath: track?.relativePath || null,
    id: track?.id || null,
    url: track?.url || null,
  });

  const openTrackMenu = (event, track, index) => {
    event.preventDefault();
    setTrackMenu({
      x: event.clientX,
      y: event.clientY,
      track,
      index,
    });
  };

  const handleMenuPlayNow = async () => {
    if (!trackMenu || !selectedPlaylist) return;
    setMenuBusy(true);
    try {
      await loadPlaylist(selectedPlaylist);
      await selectTrack(trackMenu.index);
      setTrackMenu(null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setMenuBusy(false);
    }
  };

  const handleMenuPlayNext = () => {
    if (!trackMenu?.track) return;
    queueTrackNext(trackMenu.track);
    setTrackMenu(null);
  };

  const handleMenuAddToQueue = () => {
    if (!trackMenu?.track) return;
    queueTrack(trackMenu.track);
    setTrackMenu(null);
  };

  const handleMenuAddToPlaylist = async (filename) => {
    if (!trackMenu?.track || !filename) return;
    setMenuBusy(true);
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(filename)}/add-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getTrackPayload(trackMenu.track))
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add track to playlist');

      if (selectedPlaylist?.filename === filename) {
        await handleSelectPlaylist({ name: selectedPlaylist.name, filename: selectedPlaylist.filename });
      }

      setTrackMenu(null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setMenuBusy(false);
    }
  };

  const handleMenuRemoveFromCurrentPlaylist = async () => {
    if (!trackMenu?.track || !selectedPlaylist?.filename) return;
    setMenuBusy(true);
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(selectedPlaylist.filename)}/remove-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getTrackPayload(trackMenu.track))
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove track from playlist');

      await handleSelectPlaylist({ name: selectedPlaylist.name, filename: selectedPlaylist.filename });
      setTrackMenu(null);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setMenuBusy(false);
    }
  };

  const handlePlayPlaylist = () => {
    if (selectedPlaylist && selectedPlaylist.tracks.length > 0) {
      loadPlaylist(selectedPlaylist);
    }
  };

  const handleImportSpotify = async () => {
    if (!spotifyUrl.trim()) return;

    setImportStatus({ loading: true, message: 'SYNCING API...', type: 'loading' });

    try {
      const response = await fetch('/api/playlists/import-spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotifyUrl: spotifyUrl.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      const missing = data.totalCount - data.matchedCount;
      setImportStatus({
        loading: false,
        message: `OK: ${data.matchedCount}/${data.totalCount} MATCHED${missing > 0 ? ` — ${missing} MISSING` : ''}`,
        type: missing > 0 ? 'idle' : 'success'
      });
      setMissingAlbums(data.missingAlbums || []);
      setExpandedAlbums({});
      setSpotifyUrl('');

      // Refresh the playlists list
      fetchPlaylists();

    } catch (error) {
      setImportStatus({
        loading: false,
        message: `ERR: ${error.message.toUpperCase()}`,
        type: 'error'
      });
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/playlists/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create playlist');
      setNewPlaylistName('');
      setIsCreating(false);
      fetchPlaylists();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAlbumExpand = (key) => {
    setExpandedAlbums(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyMissingAlbums = () => {
    if (!missingAlbums.length) return;
    const lines = [`MISSING ALBUMS (${missingAlbums.length})\n`];
    for (const entry of missingAlbums) {
      lines.push(`${entry.album || 'Unknown Album'} — ${entry.artist}`);
      for (const t of entry.tracks) lines.push(`  • ${t.title}`);
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist || !selectedPlaylist.filename) return;
    if (!window.confirm(`Delete playlist '${selectedPlaylist.name}'?`)) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(selectedPlaylist.filename)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete playlist');
      setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors = {
    idle: '#888',
    loading: '#facc15', // Amber
    success: '#4ade80', // Green
    error: '#f87171'    // Red
  };

  const isChecking = connectionStatus === 'checking' || importStatus.loading;
  const isConnected = connectionStatus === 'connected' && !importStatus.loading;
  const isDisconnected = connectionStatus === 'disconnected' || importStatus.type === 'error';

  const connectionLabel = isChecking
    ? '[CHECKING]'
    : isConnected
      ? '[CONNECTED]'
      : '[DISCONNECTED]';

  const connectionColor = isChecking
    ? '#facc15'
    : isConnected
      ? '#4ade80'
      : '#f87171';

  return (
    <main className="panel playlists-page">
      <div className="playlists-container">
        {/* Left Rack: Playlist Selection */}
        <section className="playlist-rack">
          <div className="rack-header">
            <h3>INPUT CHANNELS</h3>
            <div className="rack-led-strip">
              <span className={`led green ${isConnected ? 'on' : ''}`}></span>
              <span className={`led yellow ${isChecking ? 'on' : ''}`}></span>
              <span className={`led red ${isDisconnected ? 'on' : ''}`}></span>
            </div>
          </div>

          <div className="rack-import-section" style={{ marginBottom: '24px', padding: '12px', background: 'linear-gradient(135deg, #181818, #0a0a0a)', border: '1px solid #000', borderRadius: '4px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>SPOTIFY DATA SYNC</span>
              <span style={{ color: connectionColor }}>
                {connectionLabel}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/..."
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                disabled={importStatus.loading}
                style={{
                  flex: 1,
                  background: '#050505',
                  border: '1px solid #222',
                  borderRadius: '2px',
                  padding: '6px 8px',
                  color: '#f3f4f6',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  outline: 'none',
                  minWidth: '0'
                }}
              />
              <button
                onClick={handleImportSpotify}
                disabled={importStatus.loading || !spotifyUrl.trim()}
                style={{
                  background: 'linear-gradient(145deg, #222, #111)',
                  border: '1px solid #000',
                  color: importStatus.loading ? '#facc15' : (spotifyUrl.trim() ? '#fff' : '#555'),
                  padding: '0 12px',
                  borderRadius: '2px',
                  cursor: importStatus.loading || !spotifyUrl.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  transition: 'all 0.1s'
                }}
              >
                {importStatus.loading ? '...' : 'SYNC'}
              </button>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: statusColors[importStatus.type], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              &gt; {importStatus.message}
            </div>

            {missingAlbums.length > 0 && (
              <div style={{ marginTop: '10px', borderTop: '1px solid #1a1a1a', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontFamily: 'monospace', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>MISSING ALBUMS ({missingAlbums.length})</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#555', fontSize: '0.6rem' }}>CLICK TO EXPAND</span>
                    <button
                      onClick={handleCopyMissingAlbums}
                      title="Copy missing albums to clipboard"
                      style={{ background: '#111', border: '1px solid #2a2a2a', color: '#aaa', fontFamily: 'monospace', fontSize: '0.6rem', padding: '2px 6px', cursor: 'pointer', borderRadius: '2px' }}
                    >
                      COPY
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {missingAlbums.map((entry, i) => {
                    const key = `${entry.album}__${entry.artist}`;
                    const isOpen = expandedAlbums[key];
                    return (
                      <div key={i} style={{ background: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: '2px' }}>
                        <button
                          onClick={() => toggleAlbumExpand(key)}
                          style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                        >
                          <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                            {entry.album || 'UNKNOWN ALBUM'}
                            <span style={{ color: '#666', marginLeft: '4px' }}>— {entry.artist}</span>
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#f87171', flexShrink: 0 }}>
                            {entry.tracks.length} TRK {isOpen ? '▲' : '▼'}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 7px 6px', borderTop: '1px solid #1a1a1a' }}>
                            {entry.tracks.map((t, j) => (
                              <div key={j} style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#888', padding: '2px 0', borderBottom: j < entry.tracks.length - 1 ? '1px solid #111' : 'none', display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#444', minWidth: '16px' }}>{j + 1}.</span>
                                <span style={{ color: '#aaa' }}>{t.title}</span>
                                {t.artist !== entry.artist && <span style={{ color: '#555', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>{t.artist}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: '#aaa', fontSize: '0.8rem', letterSpacing: '0.1em' }}>LOCAL ARCHIVE</h4>
            <button
              onClick={() => setIsCreating(!isCreating)}
              style={{ background: 'transparent', border: 'none', color: '#f3f4f6', cursor: 'pointer', fontFamily: 'monospace', fontSize: '1.2rem', padding: '0 5px' }}
              title="New Playlist"
            >
              +
            </button>
          </div>

          {isCreating && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                style={{ flex: 1, background: '#050505', border: '1px solid #222', color: '#fff', padding: '6px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                autoFocus
              />
              <button
                onClick={handleCreatePlaylist}
                style={{ background: '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer', padding: '0 8px', fontSize: '0.8rem' }}
              >
                OK
              </button>
            </div>
          )}

          <div className="rack-slots">
            {playlists.length === 0 ? (
              <p className="muted">No playlists found.</p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.filename}
                  className={`rack-slot ${selectedPlaylist?.name === pl.name ? 'active' : ''}`}
                  onClick={() => handleSelectPlaylist(pl)}
                >
                  <div className="slot-indicator"></div>
                  <span className="slot-label">{pl.name}</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Right Panel: Track List / Details */}
        <section className="playlist-details">
          {selectedPlaylist ? (
            <div className="details-content">
              <div className="details-header">
                <div className="playlist-info">
                  <h2>{selectedPlaylist.name}</h2>
                  <p className="muted">{selectedPlaylist.tracks.length} Tracks</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedPlaylist.filename && (
                    <button
                      onClick={handleDeletePlaylist}
                      className="delete-btn"
                    >
                      DELETE
                    </button>
                  )}
                  <button
                    className="play-btn"
                    onClick={handlePlayPlaylist}
                    disabled={selectedPlaylist.tracks.length === 0}
                  >
                    LOAD INTO PLAYER
                  </button>
                </div>
              </div>

              <div className="track-list-container">
                <table className="playlist-tracks">
                  <thead>
                    <tr>
                      <th className="num-col">#</th>
                      <th>TITLE</th>
                      <th>ARTIST</th>
                      <th className="album-col">ALBUM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlaylist.tracks.map((track, idx) => (
                      <tr
                        key={idx}
                        className="track-row"
                        onContextMenu={(event) => openTrackMenu(event, track, idx)}
                        title="Right-click for track actions"
                      >
                        <td className="num-col muted">{idx + 1}</td>
                        <td className="track-title">{track.title}</td>
                        <td className="track-artist muted">{track.artist}</td>
                        <td className="album-col muted">{track.album}</td>
                      </tr>
                    ))}
                    {selectedPlaylist.tracks.length === 0 && (
                      <tr>
                        <td colSpan="4" className="muted text-center">Playlist is empty or tracks are missing locally.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="placeholder-content">
              <div className="rack-logo">
                <span className="logo-icon">≣</span>
                <h3>VIRTUAL PLAYLIST MODULE</h3>
                <p className="muted">SELECT A CHANNEL TO BEGIN</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <TrackContextMenu
        menu={trackMenu}
        busy={menuBusy}
        playlists={playlists}
        onPlayNow={handleMenuPlayNow}
        onPlayNext={handleMenuPlayNext}
        onAddToQueue={handleMenuAddToQueue}
        onAddToPlaylist={handleMenuAddToPlaylist}
        showRemoveFromCurrentPlaylist={Boolean(selectedPlaylist?.filename)}
        onRemoveFromCurrentPlaylist={handleMenuRemoveFromCurrentPlaylist}
      />

      {isLoading && <div className="loading-overlay">PROCESSING...</div>}
      {error && <div className="error-banner">ERROR: {error}</div>}
    </main>
  );
}
