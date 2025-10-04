// src/utils/AudioStreamManager.js

/**
 * Manages multiple audio streams from different peers
 * Creates and controls individual audio elements for each remote peer
 */
export class AudioStreamManager {
  constructor() {
    this.audioElements = new Map(); // Map<peerId, HTMLAudioElement>
    this.volumes = new Map(); // Map<peerId, number>
    this.mutedPeers = new Set(); // Set<peerId>
    this.ensureAudioContainer();
  }

  /**
   * Ensure the audio container exists in the DOM
   */
  ensureAudioContainer() {
    let container = document.getElementById('audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'audio-container';
      container.style.display = 'none';
      document.body.appendChild(container);
    }
    this.container = container;
  }

  /**
   * Add a remote audio stream for a peer
   */
  addStream(peerId, stream) {
    // Remove existing stream if present
    this.removeStream(peerId);

    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.id = `audio-${peerId}`;
    
    // Set initial volume (default to 1.0)
    const volume = this.volumes.get(peerId) || 1.0;
    audio.volume = volume;

    // Set mute state if peer was previously muted
    audio.muted = this.mutedPeers.has(peerId);

    // Handle mobile Safari autoplay issues
    audio.play().catch(err => {
      console.warn(`Autoplay blocked for peer ${peerId}:`, err);
      // On mobile Safari, user gesture required
      // This will be handled by user interaction
    });

    this.container.appendChild(audio);
    this.audioElements.set(peerId, audio);

    console.log(`Added audio stream for peer: ${peerId}`);
  }

  /**
   * Remove audio stream for a peer
   */
  removeStream(peerId) {
    const audio = this.audioElements.get(peerId);
    if (audio) {
      // Stop all tracks
      if (audio.srcObject) {
        audio.srcObject.getTracks().forEach(track => track.stop());
        audio.srcObject = null;
      }
      
      // Remove from DOM
      audio.remove();
      this.audioElements.delete(peerId);
      
      console.log(`Removed audio stream for peer: ${peerId}`);
    }
  }

  /**
   * Set volume for a specific peer (0.0 to 1.0)
   */
  setVolume(peerId, volume) {
    const normalizedVolume = Math.max(0, Math.min(1, parseFloat(volume)));
    this.volumes.set(peerId, normalizedVolume);

    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.volume = normalizedVolume;
    }
  }

  /**
   * Get current volume for a peer
   */
  getVolume(peerId) {
    return this.volumes.get(peerId) || 1.0;
  }

  /**
   * Mute or unmute a specific peer
   */
  setMuted(peerId, muted) {
    if (muted) {
      this.mutedPeers.add(peerId);
    } else {
      this.mutedPeers.delete(peerId);
    }

    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.muted = muted;
    }
  }

  /**
   * Check if a peer is muted
   */
  isMuted(peerId) {
    return this.mutedPeers.has(peerId);
  }

  /**
   * Toggle mute state for a peer
   */
  toggleMute(peerId) {
    const currentlyMuted = this.isMuted(peerId);
    this.setMuted(peerId, !currentlyMuted);
    return !currentlyMuted;
  }

  /**
   * Remove all audio streams and cleanup
   */
  removeAllStreams() {
    this.audioElements.forEach((audio, peerId) => {
      this.removeStream(peerId);
    });
    this.audioElements.clear();
    this.volumes.clear();
    this.mutedPeers.clear();
  }

  /**
   * Get list of all active peer IDs
   */
  getActivePeerIds() {
    return Array.from(this.audioElements.keys());
  }

  /**
   * Get count of active streams
   */
  getStreamCount() {
    return this.audioElements.size;
  }
}
