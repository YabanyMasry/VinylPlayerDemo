import './TrackContextMenu.css'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default function TrackContextMenu({
  menu,
  busy = false,
  playlists = [],
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  showRemoveFromCurrentPlaylist = false,
  onRemoveFromCurrentPlaylist,
}) {
  if (!menu) return null

  const top = typeof window === 'undefined' ? menu.y : clamp(menu.y, 8, window.innerHeight - 340)
  const left = typeof window === 'undefined' ? menu.x : clamp(menu.x, 8, window.innerWidth - 280)
  const submenuOnLeft = typeof window !== 'undefined' && left + 520 > window.innerWidth

  return (
    <div
      className={`track-context-menu ${submenuOnLeft ? 'track-context-menu--submenu-left' : ''}`}
      style={{ top, left }}
      onClick={(event) => event.stopPropagation()}
    >
      <button className="track-context-menu__item" disabled={busy} onClick={onPlayNow}>
        Play Now
      </button>
      <button className="track-context-menu__item" disabled={busy} onClick={onPlayNext}>
        Play Next
      </button>
      <button className="track-context-menu__item" disabled={busy} onClick={onAddToQueue}>
        Add To Queue
      </button>

      {showRemoveFromCurrentPlaylist && (
        <button
          className="track-context-menu__item track-context-menu__item--danger"
          disabled={busy}
          onClick={onRemoveFromCurrentPlaylist}
        >
          Remove From This Playlist
        </button>
      )}

      <div className="track-context-menu__divider" />
      <div className="track-context-menu__submenu-trigger">
        <div className="track-context-menu__item track-context-menu__item--submenu" aria-hidden="true">
          <span>Add To Playlist</span>
          <span className="track-context-menu__chevron">&#9656;</span>
        </div>

        <div className="track-context-menu__submenu" onClick={(event) => event.stopPropagation()}>
          <div className="track-context-menu__section-title">Select Playlist</div>
          <div className="track-context-menu__playlist-list">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <button
                  key={playlist.filename || playlist.name}
                  className="track-context-menu__item"
                  disabled={busy}
                  onClick={() => onAddToPlaylist?.(playlist.filename)}
                >
                  {playlist.name}
                </button>
              ))
            ) : (
              <div className="track-context-menu__empty">No playlists available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
