// src/components/PeerControls.jsx

import { useState } from 'react';

function PeerControls({ peerId, audioManager, onRemove }) {
  const [volume, setVolume] = useState(audioManager?.getVolume(peerId) || 1.0);
  const [isMuted, setIsMuted] = useState(audioManager?.isMuted(peerId) || false);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioManager?.setVolume(peerId, newVolume);
  };

  const handleToggleMute = () => {
    const newMutedState = audioManager?.toggleMute(peerId);
    setIsMuted(newMutedState);
  };

  const handleRemovePeer = () => {
    if (onRemove) {
      onRemove(peerId);
    }
  };

  return (
    <div className="peer-controls">
      <div className="volume-control">
        <label htmlFor={`volume-${peerId}`}>
          🔊
        </label>
        <input
          id={`volume-${peerId}`}
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
          className="volume-slider"
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        <span className="volume-label">{Math.round(volume * 100)}%</span>
      </div>

      <div className="peer-actions">
        <button
          onClick={handleToggleMute}
          className={`btn-icon ${isMuted ? 'muted' : ''}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        <button
          onClick={handleRemovePeer}
          className="btn-icon btn-remove"
          title="Disconnect"
        >
          ❌
        </button>
      </div>
    </div>
  );
}

export default PeerControls;
