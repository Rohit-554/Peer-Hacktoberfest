// src/components/PeerList.jsx

import { useState, useEffect } from 'react';
import PeerControls from './PeerControls';
import ConnectionStatus from './ConnectionStatus';
import { MESSAGES, CONNECTION_STATES } from '../utils/constants';

function PeerList({ peers, connectionStates, audioManager, onRemovePeer }) {
  const [expandedPeers, setExpandedPeers] = useState(new Set());

  // Auto-expand newly connected peers
  useEffect(() => {
    peers.forEach(peer => {
      if (connectionStates[peer.id] === CONNECTION_STATES.CONNECTED) {
        setExpandedPeers(prev => new Set([...prev, peer.id]));
      }
    });
  }, [peers, connectionStates]);

  const toggleExpand = (peerId) => {
    setExpandedPeers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(peerId)) {
        newSet.delete(peerId);
      } else {
        newSet.add(peerId);
      }
      return newSet;
    });
  };

  const truncatePeerId = (id, length = 8) => {
    return id.length > length ? `${id.substring(0, length)}...` : id;
  };

  const copyPeerId = (peerId) => {
    navigator.clipboard.writeText(peerId)
      .then(() => alert(MESSAGES.COPY_SUCCESS))
      .catch(() => alert(MESSAGES.COPY_FAIL));
  };

  if (peers.length === 0) {
    return (
      <div className="peer-list-empty">
        <p className="empty-message">
          {MESSAGES.NO_PEERS}
        </p>
      </div>
    );
  }

  return (
    <div className="peer-list">
      <div className="peer-list-header">
        <h3>Connected Peers ({peers.length})</h3>
      </div>

      <div className="peer-items">
        {peers.map(peer => (
          <div key={peer.id} className="peer-item">
            <div className="peer-header" onClick={() => toggleExpand(peer.id)}>
              <div className="peer-info">
                <span className="peer-id" title={peer.id}>
                  {truncatePeerId(peer.id)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPeerId(peer.id);
                  }}
                  className="btn-copy"
                  title="Copy full peer ID"
                >
                  📋
                </button>
              </div>

              <div className="peer-status">
                <ConnectionStatus state={connectionStates[peer.id]} />
                <button className="btn-expand">
                  {expandedPeers.has(peer.id) ? '▼' : '▶'}
                </button>
              </div>
            </div>

            {expandedPeers.has(peer.id) && 
             connectionStates[peer.id] === CONNECTION_STATES.CONNECTED && (
              <div className="peer-details">
                <PeerControls
                  peerId={peer.id}
                  audioManager={audioManager}
                  onRemove={onRemovePeer}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PeerList;
