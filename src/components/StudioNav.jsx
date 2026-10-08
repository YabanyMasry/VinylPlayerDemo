import React from 'react';
import { Link } from 'react-router-dom';
import './StudioNav.css';

export default function StudioNav({
  items = [],
  activeHref,
  className = ''
}) {
  const hasElectronControls = typeof window !== 'undefined' && window.electronAPI;

  return (
    <div className={`vp-studio-nav-container ${className}`} style={{ WebkitAppRegion: 'drag', display: 'flex', alignItems: 'flex-start', paddingTop: '10px' }}>
      <nav className="vp-studio-nav-plate" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* The Input Channels */}
        <div className="vp-nav-channels">
          {items.map((item) => {
            const isActive = activeHref === item.href || (activeHref.startsWith(item.href) && item.href !== '/');
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`vp-nav-btn ${isActive ? 'vp-nav-btn--active' : ''}`}
                draggable="false"
              >
                <span className="vp-nav-led"></span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {hasElectronControls && (
          <div className="vp-nav-window-controls">
            <button className="vp-nav-control-btn minimize" onClick={() => window.electronAPI.minimize()}>
              <span>&minus;</span>
            </button>
            <button className="vp-nav-control-btn maximize" onClick={() => window.electronAPI.maximize()}>
              <span>&#10064;</span>
            </button>
            <button className="vp-nav-control-btn close" onClick={() => window.electronAPI.close()}>
              <span>&#10005;</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}