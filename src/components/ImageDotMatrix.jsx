import React, { useEffect, useState, useMemo } from 'react';

// Using exact styles and filters as ElevenLabsMatrix
export default function ImageDotMatrix({
  src,
  width = 80,
  height = 80,
  cols = 8,
  rows = 8,
  dotSize = 10,
  gap = 1.5,
  opacity = 0.9,
  className = ''
}) {
  const [pixelData, setPixelData] = useState([]);

  useEffect(() => {
    if (!src) {
      setPixelData([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = cols;
      offCanvas.height = rows;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(img, 0, 0, cols, rows);

      const imageData = offCtx.getImageData(0, 0, cols, rows);
      const data = imageData.data;

      const newPixelData = [];
      for (let y = 0; y < rows; y++) {
        const rowData = [];
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Calculate perceptual brightness for glow intensity
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          rowData.push({
            r, g, b,
            brightness,
            alpha: a / 255
          });
        }
        newPixelData.push(rowData);
      }
      setPixelData(newPixelData);
    };
    img.src = src;
  }, [src, cols, rows]);

  const cellPositions = useMemo(() => {
    const p = []
    for (let r = 0; r < rows; r++) {
      p[r] = []
      for (let c = 0; c < cols; c++) {
        p[r][c] = { x: c * (dotSize + gap), y: r * (dotSize + gap) }
      }
    }
    return p
  }, [rows, cols, dotSize, gap])

  const svgW = cols * (dotSize + gap) - gap;
  const svgH = rows * (dotSize + gap) - gap;

  return (
    <div
      className={`el-matrix ${className}`}
      style={{
        width, height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <filter id="matrix-glow-img" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {cellPositions.map((row, ri) =>
          row.map((pos, ci) => {
            const pixel = pixelData[ri]?.[ci];

            // Background / "Off" state
            let fill = 'rgba(255,255,255,0.5)';
            let fillOpacity = 0.45; 
            let scale = 1;
            let applyGlow = false;

            // If the pixel has any data at all, turn it fully "ON"
            if (pixel && pixel.alpha > 0.0) { 
              applyGlow = true; // ALL active pixels get the glow filter now

              // The Math: Base opacity is locked at 90%. 
              // We add up to 10% more based on the pixel's inherent brightness.
              // So a pitch-black pixel is 90% bright, and pure white is 100% bright.
              const uniformlyBright = 0.90 + (pixel.brightness * 0.10);

              fillOpacity = uniformlyBright * opacity;
              fill = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
              scale = 1.1; // Make them all slightly larger to complete the glow effect
            }

            const radius = (dotSize / 2) * 0.9;

            return (
              <circle
                key={`${ri}-${ci}`}
                // Use applyGlow to trigger the active class if you have CSS tied to it
                className={`matrix-pixel ${applyGlow ? 'matrix-pixel-active' : ''}`}
                cx={pos.x + dotSize / 2}
                cy={pos.y + dotSize / 2}
                r={radius}
                fill={fill}
                opacity={fillOpacity}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                  // ALL active pixels now get the SVG blur filter
                  filter: applyGlow ? 'url(#matrix-glow-img)' : 'none'
                }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}