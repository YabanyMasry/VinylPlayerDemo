import React, { useState, useEffect } from 'react';
import { usePlayer } from '../state/PlayerContext';
import './SettingsPage.css'; // Don't forget to import the CSS!

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

// ----------------------------------------------------------------------------
// Reusable Fader Component
// ----------------------------------------------------------------------------
const RetroFader = ({ label, value, min, max, step, onChange, unit = "", highlightColor = "#38bdf8", description, displayValue }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
      <div>
        <span style={{ fontWeight: '600', color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.85rem' }}>{label}</span>
        {description && <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '4px' }}>{description}</div>}
      </div>
      <span className="lcd-readout" style={{ color: highlightColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
        {displayValue !== undefined ? displayValue : value}{unit}
      </span>
    </div>
    <input 
      type="range" 
      className="retro-fader" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={onChange} 
    />
  </div>
);

export default function SettingsPage() {
  const [texturesEnabled, setTexturesEnabled] = useState(true);
  const [spotifyUser, setSpotifyUser] = useState(null);
  
  // Custom directory state
  const [albumsRoot, setAlbumsRoot] = useState('');
  const [playlistsRoot, setPlaylistsRoot] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const { audioEffects, setAudioEffects, playbackRate, setPlaybackRate, handleResetDefaults, mode, refreshLibrary } = usePlayer();

  // Helpers for Displays
  const getStereoLabel = (val) => {
    if (val === 0) return "TRUE MONO";
    if (val === 0.5) return "NORM";
    if (val > 0.95) return "ULTRA WIDE";
    return `${Math.round(val * 200)}%`;
  };

  const getFilterLabel = (val) => {
    if (val === 0) return "BYPASS";
    if (val < 0) return `LO-PASS ${Math.round(Math.abs(val) * 100)}%`;
    return `HI-PASS ${Math.round(val * 100)}%`;
  };

  useEffect(() => {
    const cookieVal = getCookie('enableAlbumTextures');
    if (cookieVal === 'false') {
      setTexturesEnabled(false);
    }

    // Fetch library info to populate directory inputs
    fetch('/api/library')
      .then(res => res.json())
      .then(data => {
        if (data.albumsRoot) setAlbumsRoot(data.albumsRoot);
        if (data.playlistsRoot) setPlaylistsRoot(data.playlistsRoot);
      })
      .catch(err => console.error("Failed to fetch library roots:", err));

    if (mode === 'spotify') {
      fetch('/api/auth/me')
        .then(res => {
          if (!res.ok) throw new Error('Not connected');
          return res.json();
        })
        .then(data => setSpotifyUser(data))
        .catch(err => console.log("Spotify profile fetch skipped/failed:", err.message));
    }
  }, [mode]);

  const handleSaveDirectories = async () => {
    setSaveStatus('Saving...');
    try {
      const response = await fetch('/api/settings/directories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ albumsRoot, playlistsRoot })
      });
      if (response.ok) {
        setSaveStatus('Saved! Rescanning library...');
        setTimeout(() => setSaveStatus(''), 3000);
        // Sync context
        if (refreshLibrary) refreshLibrary();
      } else {
        const err = await response.json();
        setSaveStatus(`Failed: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      setSaveStatus(`Failed: ${e.message}`);
    }
  };

  const handleBrowseAlbums = async () => {
    if (window.electronAPI?.selectFolder) {
      const path = await window.electronAPI.selectFolder();
      if (path) setAlbumsRoot(path);
    } else {
      alert("Native folder browser is only available in the Electron desktop app.");
    }
  };

  const handleBrowsePlaylists = async () => {
    if (window.electronAPI?.selectFolder) {
      const path = await window.electronAPI.selectFolder();
      if (path) setPlaylistsRoot(path);
    } else {
      alert("Native folder browser is only available in the Electron desktop app.");
    }
  };

  const handleToggle = (e) => {
    const checked = e.target.checked;
    setTexturesEnabled(checked);
    setCookie('enableAlbumTextures', checked ? 'true' : 'false');
    window.dispatchEvent(new Event('textureSettingChanged'));
  };

  const handleEffectChange = (key, value) => {
    setAudioEffects(prev => ({ ...prev, [key]: parseFloat(value) }));
  };

  return (
    <div style={{ padding: '40px 20px', color: '#e0e0e0', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.05em', color: '#fff' }}>SYSTEM SETUP</h1>
        
        {/* Hardware Reset Button — only in local mode */}
        {mode === 'local' && (
        <button 
          onClick={handleResetDefaults}
          style={{
            background: 'linear-gradient(145deg, #222, #111)',
            border: '1px solid #000',
            color: '#888',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)',
            transition: 'all 0.1s'
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 2px 2px 5px rgba(0,0,0,0.8)'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)'}
        >
          Reset to Analog Defaults
        </button>
        )}
      </div>


      {/* 1. System Appearance */}
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          System Appearance
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
          <label className="retro-toggle-wrapper" style={{ flexShrink: 0, marginTop: '2px' }}>
            <input type="checkbox" checked={texturesEnabled} onChange={handleToggle} />
            <span className="retro-toggle-slider"></span>
          </label>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: '#fff', marginBottom: '4px' }}>Enable Album Vinyl Textures</div>
            <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Engages the custom overlay engines for album covers inside grids and carousels, simulating light reflection, physical wear, and plastic sleeve textures to make digital covers look like real physical records. Disable to improve rendering performance.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Directory Configuration & Library Rescan */}
      {mode === 'local' && (
        <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Local Library Configuration
          </h2>
          <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
            Set the absolute folder paths where your local audio files are stored. The engine will crawl these directories to populate your albums and playlists. Remember to save and rescan after making changes.
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Albums Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Albums Directory
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  value={albumsRoot} 
                  onChange={(e) => setAlbumsRoot(e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    background: '#050505', 
                    border: '1px solid #222', 
                    color: '#38bdf8', 
                    borderRadius: '2px', 
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
                    outline: 'none'
                  }}
                  placeholder="e.g. C:\Music\Albums"
                />
                <button 
                  onClick={handleBrowseAlbums}
                  style={{
                    background: 'linear-gradient(145deg, #222, #111)',
                    border: '1px solid #000',
                    color: '#888',
                    padding: '0 24px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)',
                    transition: 'all 0.1s'
                  }}
                  onMouseDown={e => e.currentTarget.style.boxShadow = 'inset 2px 2px 5px rgba(0,0,0,0.8)'}
                  onMouseUp={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)'}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#888'}
                >
                  Browse...
                </button>
              </div>
            </div>

            {/* Playlists Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#ccc', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Playlists Directory
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  value={playlistsRoot} 
                  onChange={(e) => setPlaylistsRoot(e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    background: '#050505', 
                    border: '1px solid #222', 
                    color: '#38bdf8', 
                    borderRadius: '2px', 
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
                    outline: 'none'
                  }}
                  placeholder="e.g. C:\Music\Playlists"
                />
                <button 
                  onClick={handleBrowsePlaylists}
                  style={{
                    background: 'linear-gradient(145deg, #222, #111)',
                    border: '1px solid #000',
                    color: '#888',
                    padding: '0 24px',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)',
                    transition: 'all 0.1s'
                  }}
                  onMouseDown={e => e.currentTarget.style.boxShadow = 'inset 2px 2px 5px rgba(0,0,0,0.8)'}
                  onMouseUp={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 1px 1px 1px rgba(255,255,255,0.05)'}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#888'}
                >
                  Browse...
                </button>
              </div>
            </div>
            
            {/* Action Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', paddingTop: '24px', borderTop: '2px solid #1a1a1a' }}>
              <button 
                onClick={handleSaveDirectories}
                style={{
                  background: 'linear-gradient(145deg, #222, #0d0d0d)',
                  border: '1px solid #050505',
                  color: '#38bdf8',
                  padding: '14px 32px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontSize: '0.9rem',
                  boxShadow: '3px 3px 5px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.06), inset 1px 1px 1px rgba(255,255,255,0.08)',
                  transition: 'all 0.1s ease'
                }}
                onMouseDown={e => {
                  e.currentTarget.style.background = '#111';
                  e.currentTarget.style.boxShadow = 'inset 2px 2px 5px rgba(0,0,0,0.9)';
                  e.currentTarget.style.transform = 'translateY(2px)';
                  e.currentTarget.style.color = '#0284c7';
                }}
                onMouseUp={e => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #222, #0d0d0d)';
                  e.currentTarget.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.06), inset 1px 1px 1px rgba(255,255,255,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.color = '#38bdf8';
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
                onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
              >
                Save Folders & Rescan
              </button>
              
              {/* LCD Status Readout */}
              {saveStatus && (
                <div style={{
                  background: '#000',
                  border: '1px solid #1a1a1a',
                  borderRadius: '4px',
                  padding: '10px 16px',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  color: saveStatus.includes('Failed') ? '#ef4444' : '#4ade80',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  letterSpacing: '1px'
                }}>
                  <span style={{ marginRight: '8px', opacity: 0.5 }}></span>
                  {saveStatus.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Audio Engine: DJ Playback & Pitch */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Playback Speed & Pitch Control
        </h2>
        <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Affect the time and tuning of the playing track using classic deck emulation algorithms. 
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="Tape Speed (Rate)" value={playbackRate.toFixed(2)} 
              min="0.25" max="2" step="0.05" onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} 
              unit="x" description="Physically modifies the read speed. Reduces pitch proportionally as tempo drops, just like playing vinyl at the wrong RPM."
            />
          </div>
          <div>
            <RetroFader 
              label="Digital Pitch Shift" value={audioEffects.pitchShift} 
              min="-12" max="12" step="1" onChange={(e) => handleEffectChange('pitchShift', e.target.value)} 
              unit=" st" description="Shifts the pitch up or down by semitones without modifying the playback speed (Phase Vocoding)."
            />
          </div>
        </div>
      </div>
      )}

      {/* 4. Audio Engine: Vintage Analog Hardware */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Analog Fidelity & Destruction
        </h2>
        <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Inject physical imperfection into the pristine digital signal. Layer tape warmth, vinyl dust, or digital crunch.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="Harmonic Tape Saturation" value={audioEffects.tapeSaturation || 0} 
              displayValue={Math.round((audioEffects.tapeSaturation || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('tapeSaturation', e.target.value)} 
              unit="%" description="Soft-clipping overdrive that mimics magnetic tape. Adds musical harmonics and mild compression to the signal."
              highlightColor="#facc15"
            />
            <RetroFader 
              label="Wow & Flutter" value={audioEffects.wowFlutter || 0} 
              displayValue={Math.round((audioEffects.wowFlutter || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('wowFlutter', e.target.value)} 
              unit="%" description="Introduces random, cyclical pitch variations replicating warped records and unstable turntable/cassette motors."
            />
            <RetroFader 
              label="Synthetic Vinyl Crackle" value={audioEffects.vinylCrackle || 0}
              displayValue={Math.round((audioEffects.vinylCrackle || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('vinylCrackle', e.target.value)} 
              unit="%" highlightColor="#e35a5a" 
              description="Mixes a continuous stream of filtered noise directly into the master bus to simulate dust on a stylus."
            />
          </div>
          <div>
            <RetroFader 
              label="Lo-Fi BitCrusher" value={audioEffects.bitCrusher || 0} 
              displayValue={Math.round((audioEffects.bitCrusher || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('bitCrusher', e.target.value)} 
              unit="%" description="Reduces audio resolution and sample rate, yielding the harsh, aliased grit of early digital samplers and retro games."
            />
            <RetroFader 
              label="Distortion Crunch" value={audioEffects.distortion || 0} 
              displayValue={Math.round((audioEffects.distortion || 0) * 100)} 
              min="0" max="2" step="0.01" onChange={(e) => handleEffectChange('distortion', e.target.value)} 
              unit="%" highlightColor="#e35a5a" description="Heavy solid-state overdrive circuit. Distorts dynamics severely by pushing the signal beyond digital limits."
            />
          </div>
        </div>
      </div>
      )}

      {/* 5. Audio Engine: Filters & Dynamics */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Filters & Rhythmic Dynamics
        </h2>
        <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Shape the frequency footprint and volume envelope using club-standard DJ mix effects.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader 
              label="1-Knob DJ Isolator Filter" value={audioEffects.djFilter || 0} 
              displayValue={getFilterLabel(audioEffects.djFilter || 0)}
              min="-1" max="1" step="0.01" onChange={(e) => handleEffectChange('djFilter', e.target.value)} 
              description="Sweep left to engage a Low-pass filter (muffles high frequencies). Sweep right for a High-pass filter (removes bass punch)."
              highlightColor={audioEffects.djFilter === 0 ? "#888" : "#38bdf8"}
            />
          </div>
          <div>
            <RetroFader 
              label="Sidechain Pump" value={audioEffects.sidechainPump || 0} 
              displayValue={Math.round((audioEffects.sidechainPump || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('sidechainPump', e.target.value)} 
              unit="%" description="Generates an EDM-style volume ducking rhythm based on a standard 4-to-the-floor beat sequence."
            />
            <RetroFader 
              label="AutoWah Envelope" value={audioEffects.autoWah || 0} 
              displayValue={Math.round((audioEffects.autoWah || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('autoWah', e.target.value)} 
              unit="%" description="An envelope follower that links a funky bandpass filter automatically to the input track volume."
            />
          </div>
        </div>
      </div>
      )}

      {/* 6. Audio Engine: Spatial Effects & EQ */}
      {mode === 'local' && (
      <div className="settings-rack-panel" style={{ padding: '30px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#aaa', borderBottom: '2px solid #222', paddingBottom: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Equalizer & Spatial Modulation
        </h2>
        <div style={{ color: '#777', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Tweak acoustic output bands and place the track in a simulated three-dimensional environment.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <RetroFader label="EQ High (Treble)" value={audioEffects.eqHigh} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqHigh', e.target.value)} unit=" dB" description="Boost or cut high frequency air and hi-hats."/>
            <RetroFader label="EQ Mid" value={audioEffects.eqMid} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqMid', e.target.value)} unit=" dB" description="Adjust the presence of vocals and guitars."/>
            <RetroFader label="EQ Low (Bass)" value={audioEffects.eqLow} min="-24" max="24" step="1" onChange={(e) => handleEffectChange('eqLow', e.target.value)} unit=" dB" description="Increase or scoop kicks and sub-bass."/>
            
            <div style={{ height: '1px', background: '#222', margin: '24px 0' }} />
            
            <RetroFader 
              label="Stereo Widener" value={audioEffects.stereoWidth ?? 0.5} 
              displayValue={getStereoLabel(audioEffects.stereoWidth ?? 0.5)}
              min="0" max="1" step="0.05" onChange={(e) => handleEffectChange('stereoWidth', e.target.value)} 
              description="Narrows the signal to mono (left), or uses mid-side manipulation to push sound outside physical speaker bounds (right)."
              highlightColor={audioEffects.stereoWidth === 0 ? "#888" : "#38bdf8"}
            />
          </div>
          <div>
            <RetroFader 
              label="Global Sub-Reverb" value={audioEffects.reverb || 0} 
              displayValue={Math.round((audioEffects.reverb || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('reverb', e.target.value)} 
              unit="%" description="Places the track inside an algorithmic concert hall to simulate acoustic reflections and vast tail spaces."
            />
            <RetroFader 
              label="Feedback Delay" value={audioEffects.delay || 0} 
              displayValue={Math.round((audioEffects.delay || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('delay', e.target.value)} 
              unit="%" description="Classic tape echo. Captures playing sound and repeats it back into the mix sequentially."
            />
            <RetroFader 
              label="Chorus Intensity" value={audioEffects.chorus || 0} 
              displayValue={Math.round((audioEffects.chorus || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('chorus', e.target.value)} 
              unit="%" description="Multiplies the sound via slightly delayed, detuned copies to create sweeping thickness."
            />
            <RetroFader 
              label="Phaser Intensity" value={audioEffects.phaser || 0} 
              displayValue={Math.round((audioEffects.phaser || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('phaser', e.target.value)} 
              unit="%" description="Passes audio through all-pass filters to create dramatic notch sweeps (think jet-plane effect)."
            />
            <RetroFader 
              label="LFO Auto-Panner" value={audioEffects.autoPan || 0} 
              displayValue={Math.round((audioEffects.autoPan || 0) * 100)} 
              min="0" max="1" step="0.01" onChange={(e) => handleEffectChange('autoPan', e.target.value)} 
              unit="%" description="Automatically swings the audio from left to right ear continuously using a Low Frequency Oscillator."
            />
          </div>
        </div>
      </div>
      )}

    </div>
  );
}