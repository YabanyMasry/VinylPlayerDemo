import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../state/PlayerContext'
import gsap from 'gsap'
import vinylImage from '../assets/Vinyl.png'
import coverOverlay1 from '../assets/1.png'
import coverOverlay2 from '../assets/2.png'
import coverOverlay3 from '../assets/3.png'
import coverOverlay4 from '../assets/4.png'
import coverOverlay5 from '../assets/5.png'
import TrackContextMenu from './TrackContextMenu'
import './AlbumGridCarousel.css'

const overlays = [coverOverlay1, coverOverlay2, coverOverlay3, coverOverlay4, coverOverlay5]

function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

export default function AlbumGridCarousel({ albums = [], onPlayAlbum }) {
  const { playGlobalTrack, currentTrack, queueTrack, queueTrackNext } = usePlayer()
  const [comboMode, setComboMode] = useState('grid')
  const [enableTextures, setEnableTextures] = useState(getCookie('enableAlbumTextures') !== 'false')

  useEffect(() => {
    const handleTextureUpdate = () => {
      setEnableTextures(getCookie('enableAlbumTextures') !== 'false')
    }
    window.addEventListener('textureSettingChanged', handleTextureUpdate)
    return () => window.removeEventListener('textureSettingChanged', handleTextureUpdate)
  }, [])
  const [comboCarouselIndex, setComboCarouselIndex] = useState(0)
  const [revealedAlbumKey, setRevealedAlbumKey] = useState(null)
  const [trackMenu, setTrackMenu] = useState(null)
  const [playlists, setPlaylists] = useState([])
  const [menuBusy, setMenuBusy] = useState(false)

  const targetSizeRef = useRef(
    Math.min(window.innerWidth * 0.85, window.innerHeight * 0.85)
  )
  // We track this in state ONLY for the carousel card size — but write to
  // a CSS var directly instead of re-rendering to avoid jank during GSAP transitions.
  const carouselWrapSizeRef = useRef(null)

  const comboGridWrapRef = useRef(null)
  const comboCarouselWrapRef = useRef(null)
  const comboMorphRef = useRef(null)
  const comboGridRefs = useRef({})
  const comboTrackRef = useRef(null)
  const isComboTransitioningRef = useRef(false)

  useEffect(() => {
    const onResize = () => {
      const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.85)
      targetSizeRef.current = size
      // Write directly to CSS var — no React re-render needed
      if (carouselWrapSizeRef.current) {
        carouselWrapSizeRef.current.style.setProperty('--agc-card-size', `${size}px`)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    fetch('/api/playlists')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlaylists(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!trackMenu) return

    const closeMenu = () => setTrackMenu(null)
    const onEscape = (event) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('keydown', onEscape)
    }
  }, [trackMenu])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (comboMode === 'carousel') {
        if (event.key === 'ArrowRight') {
          setComboCarouselIndex(prev => Math.min(albums.length - 1, prev + 1))
          setRevealedAlbumKey(null)
        }
        if (event.key === 'ArrowLeft') {
          setComboCarouselIndex(prev => Math.max(0, prev - 1))
          setRevealedAlbumKey(null)
        }
        if (event.key === 'Escape') {
          if (revealedAlbumKey) setRevealedAlbumKey(null)
          else handleComboBackToGrid()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [comboMode, albums.length])

  useEffect(() => {
    if (!comboTrackRef.current) return
    gsap.to(comboTrackRef.current, {
      xPercent: -comboCarouselIndex * 100,
      duration: 0.5,
      ease: 'power3.out',
    })
  }, [comboCarouselIndex])

  useEffect(() => {
    if (!comboCarouselWrapRef.current || !comboGridWrapRef.current || !comboTrackRef.current || !comboMorphRef.current) return
    gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
    gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
    gsap.set(comboTrackRef.current, { xPercent: 0 })
    gsap.set(comboMorphRef.current, { opacity: 0, pointerEvents: 'none' })
  }, [])

  const handleComboPick = (pickedKey, pickedIndex) => {
    if (isComboTransitioningRef.current) return
    if (!comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboTrackRef.current || !comboMorphRef.current) return

    const pickedGridEl = comboGridRefs.current[pickedKey]
    const pickedData = albums[pickedIndex]
    if (!pickedGridEl || !pickedData) return

    isComboTransitioningRef.current = true

    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale,-webkit-mask-image,-webkit-mask-size,mask-image,mask-size',
    })
    gsap.set(comboMorphRef.current, { opacity: 0, pointerEvents: 'none', zIndex: 1000 })

    const coverEl = pickedGridEl.querySelector('.agc-cover-wrapper') || pickedGridEl
    const sourceRect = coverEl.getBoundingClientRect()

    gsap.set(comboTrackRef.current, { xPercent: -pickedIndex * 100 })

    const carouselCards = comboTrackRef.current.querySelectorAll('.agc-carousel-card')
    const destCardEl = carouselCards[pickedIndex]

    // Safety fallback in case the DOM card isn't queryable
    const currentSize = targetSizeRef.current
    let tX = (document.documentElement.clientWidth - currentSize) / 2
    let tY = (window.innerHeight - currentSize) / 2
    let tWidth = currentSize
    let tHeight = currentSize

    if (destCardEl) {
      const destRect = destCardEl.getBoundingClientRect()
      tX = destRect.left
      tY = destRect.top
      tWidth = destRect.width
      tHeight = destRect.height
    }

    const pickedOverlay = overlays[pickedIndex % 5]
    gsap.set(comboMorphRef.current, {
      x: sourceRect.left,
      y: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      backgroundImage: pickedData.coverUrl ? `url("${pickedData.coverUrl}")` : 'none',
      backgroundColor: pickedData.coverUrl ? 'transparent' : 'transparent',
      WebkitMaskImage: enableTextures ? `url("${pickedOverlay}")` : 'none',
      maskImage: enableTextures ? `url("${pickedOverlay}")` : 'none',
      WebkitMaskSize: 'cover',
      maskSize: 'cover',
      borderRadius: 0,
      opacity: 1,
    })
    if (enableTextures) {
      comboMorphRef.current.innerHTML = `<img src="${pickedOverlay}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: screen; pointer-events: none; z-index: 2;" />`
    }

    gsap.set(pickedGridEl, { opacity: 0 })

    const tl = gsap.timeline()

    const otherGridEls = albums
      .filter((_, i) => i !== pickedIndex)
      .map(item => comboGridRefs.current[item.key])
      .filter(Boolean)

    tl.to(
      otherGridEls,
      {
        opacity: 0,
        scale: 0.8,
        duration: 0.2,
        ease: 'power2.in',
        stagger: 0.005,
      },
      0
    )

    tl.to(comboGridWrapRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'linear',
    }, 0)

    tl.to(comboMorphRef.current, {
      scale: 1.05,
      duration: 0.2,
      ease: 'power2.out',
    }, 0)

    tl.to(comboMorphRef.current, {
      x: tX,
      y: tY,
      width: tWidth,
      height: tHeight,
      borderRadius: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0.2)

    tl.to(comboCarouselWrapRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
    }, 0.55)

    tl.to(comboMorphRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    }, 0.6)

    tl.call(() => {
      setComboMode('carousel')
      setComboCarouselIndex(pickedIndex)
      gsap.set(comboGridWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboCarouselWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })
      comboMorphRef.current.innerHTML = ''

      albums.forEach(item => {
        const el = comboGridRefs.current[item.key]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex,scale' })
      })

      isComboTransitioningRef.current = false
    })
  }

  const handleComboBackToGrid = () => {
    if (!comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboMorphRef.current) return
    if (isComboTransitioningRef.current) return

    isComboTransitioningRef.current = true
    setRevealedAlbumKey(null)

    const currentIndex = comboCarouselIndex
    const currentData = albums[currentIndex]
    if (!currentData) {
      isComboTransitioningRef.current = false
      return
    }

    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale,-webkit-mask-image,-webkit-mask-size,mask-image,mask-size',
    })

    const carouselCards = comboTrackRef.current.querySelectorAll('.agc-carousel-card')
    const sourceCardEl = carouselCards[currentIndex]

    let startX = (document.documentElement.clientWidth - targetSizeRef.current) / 2
    let startY = (window.innerHeight - targetSizeRef.current) / 2
    let startWidth = targetSizeRef.current
    let startHeight = targetSizeRef.current

    if (sourceCardEl) {
      const sourceRect = sourceCardEl.getBoundingClientRect()
      startX = sourceRect.left
      startY = sourceRect.top
      startWidth = sourceRect.width
      startHeight = sourceRect.height
    }

    const pickedOverlay = overlays[currentIndex % 5]
    gsap.set(comboMorphRef.current, {
      x: startX,
      y: startY,
      width: startWidth,
      height: startHeight,
      backgroundImage: currentData.coverUrl ? `url("${currentData.coverUrl}")` : 'none',
      backgroundColor: 'transparent',
      WebkitMaskImage: enableTextures ? `url("${pickedOverlay}")` : 'none',
      maskImage: enableTextures ? `url("${pickedOverlay}")` : 'none',
      WebkitMaskSize: 'cover',
      maskSize: 'cover',
      borderRadius: 0,
      opacity: currentData.coverUrl ? 1 : 0, // don't show ghost morph if no cover (placeholder)
      zIndex: 1000,
    })
    if (enableTextures) {
      comboMorphRef.current.innerHTML = `<img src="${pickedOverlay}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: screen; pointer-events: none; z-index: 2;" />`
    }

    const targetGridEl = comboGridRefs.current[currentData.key]
    let destX = document.documentElement.clientWidth / 2 - 110
    let destY = window.innerHeight / 2 - 110
    let destWidth = 220
    let destHeight = 220
    let targetCoverEl = null

    if (targetGridEl) {
      targetCoverEl = targetGridEl.querySelector('.agc-cover-wrapper') || targetGridEl
      const targetRect = targetCoverEl.getBoundingClientRect()
      destX = targetRect.left
      destY = targetRect.top
      destWidth = targetRect.width
      destHeight = targetRect.height
    }

    // Reset grid elements to full size/opacity instantly (within the invisible wrapper)
    albums.forEach(item => {
      const el = comboGridRefs.current[item.key]
      if (el) gsap.set(el, { opacity: 1, scale: 1, x: 0, y: 0 })
    })

    // Hide target cover only if it's an image so morph doesn't overlap weirdly
    if (targetCoverEl && currentData.coverUrl) {
      gsap.set(targetCoverEl, { opacity: 0 })
    }

    // Prepare wrapper for fade in
    gsap.set(comboGridWrapRef.current, { opacity: 0, pointerEvents: 'none' })

    const tl = gsap.timeline()

    tl.to(comboCarouselWrapRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0)

    tl.to(comboMorphRef.current, {
      x: destX,
      y: destY,
      width: destWidth,
      height: destHeight,
      borderRadius: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0)

    // Fade in the grid (seamlessly replacing the outgoing carousel + morph)
    tl.to(comboGridWrapRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0.2)

    tl.call(() => {
      setComboMode('grid')
      setTrackMenu(null)
      gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })
      comboMorphRef.current.innerHTML = ''

      if (targetCoverEl) gsap.set(targetCoverEl, { clearProps: 'opacity' })

      albums.forEach(item => {
        const el = comboGridRefs.current[item.key]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex,scale' })
      })

      isComboTransitioningRef.current = false
    })
  }

  const openTrackMenu = (event, track) => {
    event.preventDefault()
    event.stopPropagation()
    setTrackMenu({ x: event.clientX, y: event.clientY, track })
  }

  const getTrackPayload = (track) => ({
    absolutePath: track?.absolutePath || null,
    relativePath: track?.relativePath || null,
    id: track?.id || null,
    url: track?.url || null,
  })

  const handleMenuPlayNow = async () => {
    if (!trackMenu?.track) return
    setMenuBusy(true)
    try {
      if (trackMenu.track.index !== undefined) {
        await playGlobalTrack(trackMenu.track.index)
      }
      setTrackMenu(null)
    } finally {
      setMenuBusy(false)
    }
  }

  const handleMenuPlayNext = () => {
    if (!trackMenu?.track) return
    queueTrackNext(trackMenu.track)
    setTrackMenu(null)
  }

  const handleMenuAddToQueue = () => {
    if (!trackMenu?.track) return
    queueTrack(trackMenu.track)
    setTrackMenu(null)
  }

  const handleMenuAddToPlaylist = async (filename) => {
    if (!trackMenu?.track || !filename) return
    setMenuBusy(true)
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(filename)}/add-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getTrackPayload(trackMenu.track)),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add track to playlist')
      }

      setTrackMenu(null)
    } catch (error) {
      console.error(error)
    } finally {
      setMenuBusy(false)
    }
  }

  return (
    <>
      <div className="agc-grid-wrap" ref={comboGridWrapRef}>
        <ul className="agc-grid">
          {albums.map((album, idx) => (
            <li key={album.key} className="agc-item">
              <button
                type="button"
                className="agc-card"
                ref={el => {
                  comboGridRefs.current[album.key] = el
                }}
                onClick={() => handleComboPick(album.key, idx)}
                title={`View ${album.album} by ${album.artist}`}
              >
                <div className={enableTextures ? "agc-cover-wrapper" : ""} style={{
                  WebkitMaskImage: enableTextures ? `url("${overlays[idx % 5]}")` : 'none',
                  maskImage: enableTextures ? `url("${overlays[idx % 5]}")` : 'none',
                  position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden'
                }}>
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt={`${album.album} cover`} className="agc-cover" loading="lazy" />
                  ) : (
                    <div className="agc-placeholder">
                      <span>🎵</span>
                    </div>
                  )}
                  {enableTextures && <img src={overlays[idx % 5]} alt="" className="agc-cover-overlay" />}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="agc-morph" ref={comboMorphRef} aria-hidden="true" />

      <div
        className="agc-carousel-wrap"
        ref={(el) => {
          comboCarouselWrapRef.current = el
          carouselWrapSizeRef.current = el
          // Set initial CSS var for card size
          if (el) el.style.setProperty('--agc-card-size', `${targetSizeRef.current}px`)
        }}
        aria-hidden={comboMode !== 'carousel'}
        onClick={(e) => {
          if (comboMode === 'carousel') {
            if (e.target.closest('.agc-tracklist-panel')) {
              return
            }
            if (revealedAlbumKey) {
              setRevealedAlbumKey(null)
              return
            }
            if (!e.target.closest('.agc-carousel-card')) {
              handleComboBackToGrid()
            }
          }
        }}
      >
        <div className="agc-carousel-track" ref={comboTrackRef} data-active={comboCarouselIndex}>
          {albums.map((album, idx) => (
            <article key={`agc-slide-${album.key}`} className={`agc-slide ${revealedAlbumKey === album.key ? 'agc-slide--revealed' : ''} ${idx === comboCarouselIndex ? 'agc-slide--visible' : ''}`}>
              <div className="agc-carousel-card-wrap">
                <div className="agc-record-wrap" aria-hidden="true">
                  <div className="agc-record-visual">
                    <img src={vinylImage} alt="Vinyl Record" className="agc-record-bg" />
                    <div
                      className="agc-record-label"
                      style={{
                        backgroundImage: album.coverUrl ? `url("${album.coverUrl}")` : undefined,
                        background: (!album.coverUrl) ? 'linear-gradient(135deg, #2a2a5a, #1a1a3a)' : undefined,
                      }}
                    >
                      <div className="agc-record-spindle" />
                    </div>
                  </div>
                </div>
                <div
                  className={`agc-carousel-card ${enableTextures ? 'agc-cover-wrapper' : ''}`}
                  style={{
                    WebkitMaskImage: enableTextures ? `url("${overlays[idx % 5]}")` : 'none',
                    maskImage: enableTextures ? `url("${overlays[idx % 5]}")` : 'none',
                    position: 'relative', overflow: 'hidden'
                  }}
                  onClick={() => {
                    setRevealedAlbumKey(prev => prev === album.key ? null : album.key)
                  }}
                >
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt="" className="agc-cover" />
                  ) : (
                    <div className="agc-placeholder" style={{ margin: 0, height: '100%' }}>
                      <span>🎵</span>
                    </div>
                  )}
                  {enableTextures && <img src={overlays[idx % 5]} alt="" className="agc-cover-overlay" />}
                </div>

                <aside className="agc-tracklist-panel vp-tracklist-panel">
                  <h3>{album.album}</h3>
                  <p>{album.artist}</p>
                  <ul className="agc-tracklist vp-tracklist">
                    {album.tracks && album.tracks.map((track, i) => {
                      const isActive = currentTrack?.id === track.id || currentTrack?.filename === track.filename
                      return (
                      <li
                        key={track.id || i}
                        className={`agc-track-item vp-track-item ${isActive ? 'vp-track-item--active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (track.index !== undefined) {
                            playGlobalTrack(track.index)
                          } else if (onPlayAlbum) {
                            onPlayAlbum(album.album)
                          }
                        }}
                        onContextMenu={(event) => openTrackMenu(event, track)}
                      >
                        <span className="agc-track-num vp-track-num">{i + 1}</span>
                        <span className="agc-track-name vp-track-name">{track.title || track.filename || 'Unknown Track'}</span>
                      </li>
                      )
                    })}
                  </ul>
                </aside>
              </div>
            </article>
          ))}
        </div>
      </div>

      <TrackContextMenu
        menu={trackMenu}
        busy={menuBusy}
        playlists={playlists}
        onPlayNow={handleMenuPlayNow}
        onPlayNext={handleMenuPlayNext}
        onAddToQueue={handleMenuAddToQueue}
        onAddToPlaylist={handleMenuAddToPlaylist}
      />
    </>
  )
}
