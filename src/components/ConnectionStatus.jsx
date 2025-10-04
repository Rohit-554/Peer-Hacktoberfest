// src/components/ConnectionStatus.jsx

import { CONNECTION_STATES } from '../utils/constants';

function ConnectionStatus({ state }) {
  const getStatusInfo = (state) => {
    switch (state) {
      case CONNECTION_STATES.CONNECTED:
        return { emoji: '🟢', text: 'Connected', className: 'status-connected' };
      case CONNECTION_STATES.CONNECTING:
        return { emoji: '🟡', text: 'Connecting...', className: 'status-connecting' };
      case CONNECTION_STATES.FAILED:
        return { emoji: '🔴', text: 'Failed', className: 'status-failed' };
      case CONNECTION_STATES.DISCONNECTED:
      default:
        return { emoji: '⚪', text: 'Disconnected', className: 'status-disconnected' };
    }
  };

  const status = getStatusInfo(state);

  return (
    <span className={`connection-status ${status.className}`}>
      <span className="status-emoji">{status.emoji}</span>
      <span className="status-text">{status.text}</span>
    </span>
  );
}

export default ConnectionStatus;
