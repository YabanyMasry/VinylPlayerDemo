import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Dynamically scales the VinylPlayer to fit the available viewport.
 *
 * @param {number}  targetWidth   – fixed CSS width of the player (e.g. 1048)
 * @param {number}  targetHeight  – fixed CSS height of the player (e.g. 650)
 * @param {object}  [opts]
 * @param {number}  [opts.maxScale=1.0]   – upper bound so it doesn't get too big
 * @param {number}  [opts.minScale=0.45]  – lower bound so it stays usable
 * @param {string}  [opts.stageSelector='.vp-stage'] – CSS selector of the flex container
 */
export const usePlayerScale = (
  targetWidth,
  targetHeight,
  { maxScale = 1.0, minScale = 0.45, stageSelector = '.vp-stage' } = {},
) => {
  const [scale, setScale] = useState(1);
  const rafId = useRef(0);

  const recalc = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const stage = document.querySelector(stageSelector);
      if (!stage) {
        // Fallback when DOM isn't ready yet
        const w = (window.innerWidth - 80) / targetWidth;
        const h = (window.innerHeight - 160) / targetHeight;
        setScale(Math.max(minScale, Math.min(w, h, maxScale)));
        return;
      }

      const stageStyles = getComputedStyle(stage);
      const paddingX = parseFloat(stageStyles.paddingLeft) + parseFloat(stageStyles.paddingRight);
      const paddingY = parseFloat(stageStyles.paddingTop) + parseFloat(stageStyles.paddingBottom);
      const gap = parseFloat(stageStyles.gap) || parseFloat(stageStyles.columnGap) || 0;

      // Measure the tracklist panel that sits beside the player
      const tracklist = stage.querySelector('.vp-tracklist-panel');
      const tracklistWidth = tracklist ? tracklist.offsetWidth : 0;

      const availableWidth  = stage.clientWidth  - paddingX - tracklistWidth - (tracklistWidth > 0 ? gap : 0);
      const availableHeight = stage.clientHeight - paddingY;

      const widthRatio  = availableWidth  / targetWidth;
      const heightRatio = availableHeight / targetHeight;

      setScale(Math.max(minScale, Math.min(widthRatio, heightRatio, maxScale)));
    });
  }, [targetWidth, targetHeight, maxScale, minScale, stageSelector]);

  useEffect(() => {
    recalc();

    // ResizeObserver on the stage reacts to layout changes (tracklist appearing, etc.)
    const stage = document.querySelector(stageSelector);
    let ro;

    if (stage && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(recalc);
      ro.observe(stage);
    }

    // Window resize as a safety net (Electron frame dragging, monitor switch)
    window.addEventListener('resize', recalc);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('resize', recalc);
      ro?.disconnect();
    };
  }, [recalc, stageSelector]);

  return scale;
};
