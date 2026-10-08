import { usePlayer } from '../state/PlayerContext'
import AlbumGridCarousel from '../components/AlbumGridCarousel'
import './AlbumsPage.css'

export default function AlbumsPage() {
  const { albums } = usePlayer()

  return (
    <main className="panel albums-page">
      <h2 style={{ marginBottom: '24px' }}></h2>
      {albums.length === 0 ? (
        <p className="muted">No albums found.</p>
      ) : (
        <AlbumGridCarousel albums={albums} />
      )}
    </main>
  )
}
