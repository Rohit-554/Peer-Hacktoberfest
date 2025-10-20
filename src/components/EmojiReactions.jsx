// src/components/EmojiReactions.jsx

import { useState, useEffect } from 'react';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '😮', '😢'];

function EmojiReactions({ dataChannelManager, isInCall }) {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    if (!dataChannelManager) return;

    // Listen for incoming reactions from peers
    const handleReaction = (data) => {
      if (data.type === 'reaction') {
        addReaction(data.emoji, data.peerId);
      }
    };

    dataChannelManager.onMessage = handleReaction;

    return () => {
      dataChannelManager.onMessage = null;
    };
  }, [dataChannelManager]);

  const addReaction = (emoji, peerId = 'You') => {
    const id = Date.now() + Math.random();
    const newReaction = {
      id,
      emoji,
      peerId,
      x: Math.random() * 80 + 10, // Random position between 10% and 90%
    };

    setReactions(prev => [...prev, newReaction]);

    // Remove reaction after animation completes
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const sendReaction = (emoji) => {
    if (!isInCall || !dataChannelManager) return;

    // Add reaction locally
    addReaction(emoji, 'You');

    // Send to all peers
    dataChannelManager.broadcast({
      type: 'reaction',
      emoji,
      peerId: 'Peer',
      timestamp: Date.now(),
    });
  };

  if (!isInCall) return null;

  return (
    <>
      {/* Emoji Buttons */}
      <div className="emoji-reactions-panel">
        <h3>Quick Reactions</h3>
        <div className="emoji-buttons">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              className="emoji-button"
              onClick={() => sendReaction(emoji)}
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Reactions */}
      <div className="floating-reactions-container">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="floating-reaction"
            style={{
              left: `${reaction.x}%`,
              animationDuration: `${2.5 + Math.random()}s`,
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>
    </>
  );
}

export default EmojiReactions;
