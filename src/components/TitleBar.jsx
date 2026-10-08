import React from 'react';
import './TitleBar.css';

export function TitleBar() {
  // If not running in Electron, don't optionally render the titlebar
  if (!window.electronAPI) {
    return null;
  }

  return (
    <div className="electron-titlebar">
      <div className="titlebar-drag-region">
        <span className="titlebar-title">Vinyl Player</span>
      </div>
      <div className="titlebar-controls">
        <button className="control-btn minimize" onClick={() => window.electronAPI.minimize()}>
          <span>&minus;</span>
        </button>
        <button className="control-btn maximize" onClick={() => window.electronAPI.maximize()}>
          <span>&#10064;</span>
        </button>
        <button className="control-btn close" onClick={() => window.electronAPI.close()}>
          <span>&#10005;</span>
        </button>
      </div>
    </div>
  );
}
