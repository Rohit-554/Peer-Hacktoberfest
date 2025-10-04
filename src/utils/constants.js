// src/utils/constants.js

/**
 * Configuration constants for multi-peer mesh topology
 */

export const PEER_CONFIG = {
  // PeerJS server configuration
  host: '0.peerjs.com',
  port: 443,
  secure: true,
  debug: 2, // 0=none, 1=errors, 2=warnings, 3=all
};

export const ICE_CONFIG = {
  // ICE servers for NAT traversal
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Add TURN servers here for better connectivity
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ],
};

export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false, // Voice chat only
};

export const LIMITS = {
  MAX_PEERS: 6, // Maximum recommended peers for mesh topology
  WARNING_THRESHOLD: 4, // Show warning above this number
  MIN_PEERS: 1,
};

export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed',
};

export const MESSAGES = {
  MIC_DENIED: 'Microphone access denied. Please grant permission and try again.',
  MIC_ERROR: 'Failed to access microphone. Please check your device settings.',
  PEER_LIMIT: `Warning: Connecting to more than ${LIMITS.WARNING_THRESHOLD} peers may cause performance issues.`,
  COPY_SUCCESS: 'Peer ID copied to clipboard!',
  COPY_FAIL: 'Failed to copy. Please copy manually.',
  INVALID_PEER_ID: 'Please enter at least one valid peer ID.',
  NO_PEERS: 'No peers connected yet. Share your ID with others to start.',
};
