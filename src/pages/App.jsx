// src/pages/App.jsx

import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import PeerList from '../components/PeerList';
import { MultiPeerManager } from '../utils/MultiPeerManager';
import { AudioStreamManager } from '../utils/AudioStreamManager';
import { 
  PEER_CONFIG, 
  ICE_CONFIG, 
  MEDIA_CONSTRAINTS, 
  LIMITS, 
  MESSAGES,
  CONNECTION_STATES 
} from '../utils/constants';
import '../assets/styles.css';

function App() {
  // State
  const [myPeerId, setMyPeerId] = useState('');
  const [peerIdInput, setPeerIdInput] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [peers, setPeers] = useState([]);
  const [connectionStates, setConnectionStates] = useState({});
  const [showWarning, setShowWarning] = useState(false);

  // Refs
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const multiPeerManagerRef = useRef(null);
  const audioManagerRef = useRef(null);

  // Initialize PeerJS and managers
  useEffect(() => {
    console.log('Initializing Peer connection...');
    
    const peer = new Peer({
      ...PEER_CONFIG,
      config: ICE_CONFIG,
    });

    peer.on('open', (id) => {
      setMyPeerId(id);
      console.log('My peer ID:', id);
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
      alert(`Connection error: ${error.type}`);
    });

    peer.on('disconnected', () => {
      console.warn('Peer disconnected. Attempting to reconnect...');
      peer.reconnect();
    });

    // Handle incoming calls
    peer.on('call', (incomingCall) => {
      console.log('Incoming call from:', incomingCall.peer);
      
      if (localStreamRef.current && multiPeerManagerRef.current) {
        multiPeerManagerRef.current.answerCall(
          incomingCall,
          localStreamRef.current
        );
      } else {
        console.warn('Not in call, rejecting incoming call');
        incomingCall.close();
      }
    });

    peerRef.current = peer;

    // Initialize managers
    audioManagerRef.current = new AudioStreamManager();
    multiPeerManagerRef.current = new MultiPeerManager(peer, {
      onPeerStream: handlePeerStream,
      onPeerDisconnect: handlePeerDisconnect,
      onConnectionStateChange: handleConnectionStateChange,
      onError: handlePeerError,
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up...');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      audioManagerRef.current?.removeAllStreams();
      multiPeerManagerRef.current?.endAllCalls();
      peer.destroy();
    };
  }, []);

  // Callbacks
  const handlePeerStream = (peerId, stream) => {
    console.log('Received stream from:', peerId);
    audioManagerRef.current.addStream(peerId, stream);
    
    setPeers(prev => {
      if (prev.some(p => p.id === peerId)) return prev;
      return [...prev, { id: peerId }];
    });
  };

  const handlePeerDisconnect = (peerId) => {
    console.log('Peer disconnected:', peerId);
    audioManagerRef.current.removeStream(peerId);
    
    setPeers(prev => prev.filter(p => p.id !== peerId));
    setConnectionStates(prev => {
      const newStates = { ...prev };
      delete newStates[peerId];
      return newStates;
    });
  };

  const handleConnectionStateChange = (peerId, state) => {
    console.log(`Peer ${peerId} state:`, state);
    setConnectionStates(prev => ({ ...prev, [peerId]: state }));
  };

  const handlePeerError = (error, peerId) => {
    console.error(`Error with peer ${peerId}:`, error);
    alert(`Connection error with peer ${peerId}: ${error.message}`);
  };

  // Actions
  const startCall = async () => {
    const peerIds = peerIdInput
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (peerIds.length === 0) {
      alert(MESSAGES.INVALID_PEER_ID);
      return;
    }

    // Warning for too many peers
    if (peerIds.length > LIMITS.WARNING_THRESHOLD) {
      setShowWarning(true);
      if (!confirm(MESSAGES.PEER_LIMIT + ' Continue anyway?')) {
        return;
      }
    }

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
      
      localStreamRef.current = stream;
      setIsInCall(true);
      setShowWarning(false);

      // Call all peers
      peerIds.forEach(peerId => {
        if (peerId !== myPeerId) {
          console.log('Calling peer:', peerId);
          multiPeerManagerRef.current.callPeer(peerId, stream);
        }
      });

    } catch (error) {
      console.error('Failed to start call:', error);
      if (error.name === 'NotAllowedError') {
        alert(MESSAGES.MIC_DENIED);
      } else {
        alert(MESSAGES.MIC_ERROR);
      }
    }
  };

  const endCall = () => {
    console.log('Ending call...');
    
    // End all peer connections
    multiPeerManagerRef.current?.endAllCalls();
    audioManagerRef.current?.removeAllStreams();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Reset state
    setIsInCall(false);
    setIsMicMuted(false);
    setPeers([]);
    setConnectionStates({});
    setShowWarning(false);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const copyMyPeerId = () => {
    navigator.clipboard.writeText(myPeerId)
      .then(() => alert(MESSAGES.COPY_SUCCESS))
      .catch(() => alert(MESSAGES.COPY_FAIL));
  };

  const removePeer = (peerId) => {
    multiPeerManagerRef.current?.removePeer(peerId);
  };

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1>🎙️ Multi-Peer Voice Chat</h1>
          <p className="subtitle">Zero-backend, end-to-end encrypted group calls</p>
        </header>

        <main className="app-main">
          {/* My Peer ID Section */}
          <section className="section my-id-section">
            <h2>Your Peer ID</h2>
            <div className="my-id-box">
              {myPeerId ? (
                <>
                  <code className="peer-id-display">{myPeerId}</code>
                  <button onClick={copyMyPeerId} className="btn btn-secondary">
                    📋 Copy
                  </button>
                </>
              ) : (
                <span className="loading">Connecting...</span>
              )}
            </div>
            <p className="hint">Share this ID with others to connect</p>
          </section>

          {/* Connect Section */}
          <section className="section connect-section">
            <h2>Connect to Peers</h2>
            <div className="input-group">
              <input
                type="text"
                className="peer-input"
                placeholder="Enter peer IDs (comma-separated)"
                value={peerIdInput}
                onChange={(e) => setPeerIdInput(e.target.value)}
                disabled={isInCall}
              />
            </div>
            <p className="hint">
              Example: peer-id-1, peer-id-2, peer-id-3 
              (Max recommended: {LIMITS.WARNING_THRESHOLD})
            </p>

            {showWarning && (
              <div className="warning-box">
                ⚠️ {MESSAGES.PEER_LIMIT}
              </div>
            )}

            <div className="button-group">
              {!isInCall ? (
                <button
                  onClick={startCall}
                  className="btn btn-primary"
                  disabled={!myPeerId || !peerIdInput.trim()}
                >
                  📞 Start Group Call
                </button>
              ) : (
                <>
                  <button onClick={toggleMic} className="btn btn-secondary">
                    {isMicMuted ? '🔇' : '🎤'} {isMicMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button onClick={endCall} className="btn btn-danger">
                    📵 End Call
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Peer List Section */}
          {isInCall && (
            <section className="section peer-list-section">
              <PeerList
                peers={peers}
                connectionStates={connectionStates}
                audioManager={audioManagerRef.current}
                onRemovePeer={removePeer}
              />
            </section>
          )}

          {/* Info Section */}
          <section className="section info-section">
            <details>
              <summary>ℹ️ How it works</summary>
              <ul className="info-list">
                <li>Each peer maintains direct connections with all others (mesh topology)</li>
                <li>Audio is end-to-end encrypted using WebRTC DTLS-SRTP</li>
                <li>Works best with 3-6 participants on the same network or good internet</li>
                <li>No backend server needed - all communication is peer-to-peer</li>
                <li>Mobile Safari may require tapping once to enable audio playback</li>
              </ul>
            </details>
          </section>
        </main>

        <footer className="app-footer">
          <p>Built with React, Vite, PeerJS, and WebRTC</p>
          <p>
            <a 
              href="https://github.com/Rohit-554/Peer-Hacktoberfest" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
