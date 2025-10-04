// src/utils/MultiPeerManager.js

import { CONNECTION_STATES } from './constants';

/**
 * Manages multiple peer-to-peer connections in a mesh topology
 * Each peer maintains direct connections with all other peers
 */
export class MultiPeerManager {
  constructor(localPeer, callbacks = {}) {
    this.localPeer = localPeer;
    this.activeCalls = new Map(); // Map<peerId, MediaConnection>
    this.connectionStates = new Map(); // Map<peerId, string>
    
    // Callbacks
    this.onPeerStream = callbacks.onPeerStream || (() => {});
    this.onPeerDisconnect = callbacks.onPeerDisconnect || (() => {});
    this.onConnectionStateChange = callbacks.onConnectionStateChange || (() => {});
    this.onError = callbacks.onError || console.error;
  }

  /**
   * Initiate a call to a remote peer
   */
  callPeer(remotePeerId, localStream) {
    if (!remotePeerId || remotePeerId === this.localPeer.id) {
      console.warn('Invalid peer ID:', remotePeerId);
      return null;
    }

    // Check if already connected
    if (this.activeCalls.has(remotePeerId)) {
      console.warn(`Already connected to peer: ${remotePeerId}`);
      return this.activeCalls.get(remotePeerId);
    }

    try {
      this.updateConnectionState(remotePeerId, CONNECTION_STATES.CONNECTING);
      
      // Create call with local stream
      const call = this.localPeer.call(remotePeerId, localStream);
      
      if (!call) {
        throw new Error('Failed to create call');
      }

      this.setupCallHandlers(call, remotePeerId);
      this.activeCalls.set(remotePeerId, call);

      console.log(`Calling peer: ${remotePeerId}`);
      return call;
    } catch (error) {
      console.error(`Failed to call peer ${remotePeerId}:`, error);
      this.updateConnectionState(remotePeerId, CONNECTION_STATES.FAILED);
      this.onError(error, remotePeerId);
      return null;
    }
  }

  /**
   * Answer an incoming call
   */
  answerCall(incomingCall, localStream) {
    const remotePeerId = incomingCall.peer;

    if (!remotePeerId) {
      console.warn('Invalid incoming call: no peer ID');
      return;
    }

    // Close existing call if any
    if (this.activeCalls.has(remotePeerId)) {
      console.log(`Replacing existing call with ${remotePeerId}`);
      this.removePeer(remotePeerId);
    }

    try {
      this.updateConnectionState(remotePeerId, CONNECTION_STATES.CONNECTING);
      
      // Answer with local stream
      incomingCall.answer(localStream);
      
      this.setupCallHandlers(incomingCall, remotePeerId);
      this.activeCalls.set(remotePeerId, incomingCall);

      console.log(`Answered call from peer: ${remotePeerId}`);
    } catch (error) {
      console.error(`Failed to answer call from ${remotePeerId}:`, error);
      this.updateConnectionState(remotePeerId, CONNECTION_STATES.FAILED);
      this.onError(error, remotePeerId);
    }
  }

  /**
   * Setup event handlers for a call
   */
  setupCallHandlers(call, peerId) {
    // Handle remote stream
    call.on('stream', (remoteStream) => {
      console.log(`Received stream from peer: ${peerId}`);
      this.updateConnectionState(peerId, CONNECTION_STATES.CONNECTED);
      this.onPeerStream(peerId, remoteStream);
    });

    // Handle call close
    call.on('close', () => {
      console.log(`Call closed with peer: ${peerId}`);
      this.removePeer(peerId);
    });

    // Handle errors
    call.on('error', (error) => {
      console.error(`Call error with peer ${peerId}:`, error);
      this.updateConnectionState(peerId, CONNECTION_STATES.FAILED);
      this.onError(error, peerId);
      this.removePeer(peerId);
    });
  }

  /**
   * Remove a peer connection
   */
  removePeer(peerId) {
    const call = this.activeCalls.get(peerId);
    
    if (call) {
      try {
        call.close();
      } catch (error) {
        console.warn(`Error closing call with ${peerId}:`, error);
      }
      
      this.activeCalls.delete(peerId);
    }

    this.connectionStates.delete(peerId);
    this.onPeerDisconnect(peerId);
    
    console.log(`Removed peer: ${peerId}`);
  }

  /**
   * End all active calls
   */
  endAllCalls() {
    console.log('Ending all calls...');
    
    this.activeCalls.forEach((call, peerId) => {
      try {
        call.close();
      } catch (error) {
        console.warn(`Error closing call with ${peerId}:`, error);
      }
    });

    this.activeCalls.clear();
    this.connectionStates.clear();
  }

  /**
   * Update connection state for a peer
   */
  updateConnectionState(peerId, state) {
    this.connectionStates.set(peerId, state);
    this.onConnectionStateChange(peerId, state);
  }

  /**
   * Get connection state for a peer
   */
  getConnectionState(peerId) {
    return this.connectionStates.get(peerId) || CONNECTION_STATES.DISCONNECTED;
  }

  /**
   * Get list of all active peer IDs
   */
  getActivePeerIds() {
    return Array.from(this.activeCalls.keys());
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionCount() {
    return this.activeCalls.size;
  }

  /**
   * Check if connected to a specific peer
   */
  isConnectedTo(peerId) {
    return this.activeCalls.has(peerId) && 
           this.getConnectionState(peerId) === CONNECTION_STATES.CONNECTED;
  }

  /**
   * Replace local stream for all active calls
   * Useful for switching audio devices
   */
  replaceStream(newStream) {
    this.activeCalls.forEach((call) => {
      const sender = call.peerConnection?.getSenders?.()?.[0];
      if (sender && newStream.getAudioTracks()[0]) {
        sender.replaceTrack(newStream.getAudioTracks()[0])
          .catch(error => console.error('Failed to replace track:', error));
      }
    });
  }
}
