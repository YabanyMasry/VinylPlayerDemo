import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import './AlbumRecordCard.css'

export default function AlbumRecordCard({
  title,
  artist,
  colorA,
  colorB,
  isOpen,
  onToggle,
}) {
  const coverRef = useRef(null)
  const recordRef = useRef(null)

  useEffect(() => {
    if (!coverRef.current || !recordRef.current) return

    gsap.to(coverRef.current, {
      scale: isOpen ? 1 : 0.98,
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
    })

    gsap.to(recordRef.current, {
      x: isOpen ? 130 : 8,
      rotation: isOpen ? 200 : 0,
      duration: 0.75,
      ease: 'power3.out',
    })
  }, [isOpen, title])

  return (
    <div className="album-record-card">
      <div className="album-record-card__record" ref={recordRef} aria-hidden="true" />

      <button
        type="button"
        ref={coverRef}
        className="album-record-card__cover"
        style={{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }}
        aria-pressed={isOpen}
        onClick={onToggle}
      >
        <span className="album-record-card__title">{title}</span>
        <span className="album-record-card__artist">{artist}</span>
      </button>
    </div>
  )
}
