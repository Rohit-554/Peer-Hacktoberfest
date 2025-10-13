import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Peer } from 'peerjs'
import StatusSelector from "../components/StatusSelector";


// Simple in-memory presence for same-tab demo. For multi-user on same Wi-Fi without a server,
// users need to share their Peer IDs manually or via a QR/text. We add a QR helper below.

function useLocalStorage(key, initial) {
    const [v, setV] = useState(() => {
        try {
            const raw = localStorage.getItem(key)
            return raw ? JSON.parse(raw) : initial
        } catch { return initial }
    })
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(v)) } catch { }
    }, [key, v])
    return [v, setV]
}

const defaultConfig = {
    // Use PeerJS public cloud broker to avoid running your own signalling server.
    // On corporate networks this may be blocked; LAN still works if STUN fails and peers are reachable.
    // For stricter LAN-only, consider a local PeerServer (not supported on GitHub Pages).
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/' // default path for public broker
}



function copy(text) {
    navigator.clipboard?.writeText(text).catch(() => { })
}

// QR Code generator using canvas
function generateQR(text, size = 200) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Simple QR code using Google Charts API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
    
    return qrUrl
}

//Helper function 
async function toggleScreenShare() {
  if (isScreenSharing) {
    stopScreenShare();
  } else {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Send screen stream to all connected peers
      peers.forEach((peer) => {
        const conn = peerRef.current.connections[peer.id]?.[0];
        if (conn) {
          const sender = conn.peerConnection.getSenders().find(s => s.track.kind === "video");
          if (sender) sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
      });

      screenStream.getVideoTracks()[0].onended = stopScreenShare; // stops when user clicks browser stop
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }
}

function stopScreenShare() {
  if (screenStreamRef.current) {
    screenStreamRef.current.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
  }
  setIsScreenSharing(false);
}


export default function App() {
    const [cfg, setCfg] = useLocalStorage('peer.cfg', defaultConfig)
    const [label, setLabel] = useLocalStorage('peer.label', '')
    const [recentRooms, setRecentRooms] = useLocalStorage('peer.recentRooms', [])
    // replacing const [status, setStatus] = useState('idle')

    const [status, setStatus] = useState(localStorage.getItem("peer.status") || 'idle');
    //Add a peerStatuses state object:
    const [peerStatuses, setPeerStatuses] = useState({});
    const [myId, setMyId] = useState('')
    const [peerIdInput, setPeerIdInput] = useState('')
    const [roomCode, setRoomCode] = useState('')
    const [peers, setPeers] = useState([])
    const [log, setLog] = useState([])
    const [muted, setMuted] = useState(false)
    const [connected, setConnected] = useState(false)
    const [streamActive, setStreamActive] = useState(false)
    const [showQR, setShowQR] = useState(false)
    const [messages, setMessages] = useState([])
    const [msgInput, setMsgInput] = useState('')
    const [showRecentRooms, setShowRecentRooms] = useState(false)

    const peerRef = useRef(null)
    const connRef = useRef({})
    const mediaRef = useRef(null)
    const audioRef = useRef(null)
    const chatEndRef = useRef(null)

    //Add State and Refs for Screen Sharing
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteScreenStream, setRemoteScreenStream] = useState(null);
    const remoteScreenRef = useRef(null); // For displaying remote screen
    // State to track if local screen is being shared
    const [sharingScreen, setSharingScreen] = useState(false);
    //adding function for better optimization
    const localScreenRef = useRef(null);

    function getStatusColor(status) {
      switch(status) {
        case 'online': return '#10b981';
        case 'away':   return '#f59e0b';
        case 'busy':   return '#ef4444';
        case 'offline':return '#6b7280';
        default:       return '#10b981';
      }
    }


      async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setSharingScreen(true);
        localScreenRef.current = stream;

        // Send this stream to all connected peers
        Object.values(connRef.current).forEach(conn => {
            if (conn && conn.open && conn.peerConnection) {
                const sender = conn.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
            }
        });

        // Stop sharing if user stops manually
        stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
        console.error('Screen share error:', err);
        pushLog('Screen share error: ' + err.message);
    }
}

function stopScreenShare() {
    // Revert back to normal video/mic track
    Object.values(connRef.current).forEach(conn => {
        if (conn && conn.open && conn.peerConnection && mediaRef.current) {
            const sender = conn.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(mediaRef.current.getVideoTracks()[0]);
        }
    });

    if (localScreenRef.current) {
        localScreenRef.current.getTracks().forEach(track => track.stop());
        localScreenRef.current = null;
    }

    setSharingScreen(false);
}

    const peerOptions = useMemo(() => ({
        host: cfg.host, port: Number(cfg.port), secure: !!cfg.secure, path: cfg.path || '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                // You can add a TURN server for NATs that block P2P (requires your own credentials)
            ],
            sdpSemantics: 'unified-plan'
        },
        debug: 1
    }), [cfg])

    useEffect(() => {
        setStatus('initializing')
        const peer = new Peer(undefined, peerOptions)
        peerRef.current = peer

        peer.on('open', (id) => {
            setMyId(id)
            setStatus('ready')
            pushLog(`Your ID: ${id}`)
        })

        peer.on('error', (err) => {
            pushLog('Peer error: ' + err.type + ' ' + (err.message || ''))
            if (err.type === 'unavailable-id' || err.type === 'network') setStatus('error')
        })

        peer.on('connection', (conn) => {
            setupDataConnection(conn)
        })

       peer.on('call', async (call) => {
    try {
        if (call.metadata?.type === 'screen') {
            // This is a screen share
            call.answer(); // usually no local screen stream needed
            call.on('stream', (remote) => {
                setRemoteScreenStream(remote); // <-- store remote screen stream
                if (remoteScreenRef.current) {
                    remoteScreenRef.current.srcObject = remote;
                }
            });
            call.on('close', () => setRemoteScreenStream(null));
        } else {
            // Normal audio call
            const stream = await getMic();
            call.answer(stream);
            setStreamActive(true);
            call.on('stream', (remote) => attachRemoteAudio(remote));
            call.on('close', () => setStreamActive(false));
        }
    } catch (e) {
        pushLog('Call error: ' + e.message);
    }
});




        return () => {
            peer.destroy()
            peerRef.current = null
        }
    }, [peerOptions])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    function pushLog(x) { setLog((l) => [x, ...l].slice(0, 200)) }

    async function getMic() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        })
        mediaRef.current = stream
        return stream
    }

    function attachRemoteAudio(remote) {
        if (!audioRef.current) return
        audioRef.current.srcObject = remote
        audioRef.current.play().catch(() => { })
    }

    function setupDataConnection(conn) {
        connRef.current = conn
        setConnected(true)
        pushLog('Connected to ' + conn.peer)

      conn.on('data', (data) => {
    if (!data) return;

    switch (data.type) {
        case 'presence':
            // Merge presence info into peers list
            setPeers((prevPeers) => mergePeers(prevPeers, data.payload));
            break;

        case 'message':
            // Append incoming chat message
            setMessages((msgs) => [
                ...msgs,
                {
                    text: data.text,
                    sender: data.sender,
                    timestamp: data.timestamp,
                    isMe: false,
                },
            ]);
            pushLog(`Message from ${data.sender}: ${data.text}`);
            break;

        case 'status-update':
            // Update peerStatuses map with latest status
            setPeerStatuses((prev) => ({
                ...prev,
                [conn.peer]: data.status,
            }));
            pushLog(`Status update from ${conn.peer}: ${data.status}`);
            break;

        case 'signal':
            // Reserved for future signals
            break;

        default:
            console.warn('Unknown data type received:', data);
            break;
    }
});



        conn.on('close', () => {
            setConnected(false)
            pushLog('Disconnected from ' + conn.peer)
        })
    }

    function mergePeers(cur, incoming) {
        const map = new Map(cur.map((x) => [x.id, x]))
        incoming.forEach((x) => map.set(x.id, { ...map.get(x.id), ...x }))
        return Array.from(map.values())
    }

    async function callPeer(targetId) {
        if (!peerRef.current || !targetId) return
        try {
            const stream = await getMic()
            setStreamActive(true)
            const call = peerRef.current.call(targetId, stream, { metadata: { from: myId, label } })
            call.on('stream', (remote) => attachRemoteAudio(remote))
            call.on('close', () => setStreamActive(false))
        } catch (e) {
            pushLog('Mic error: ' + e.message)
        }
    }

    function connectData(targetId) {
        if (!peerRef.current || !targetId) return
        const conn = peerRef.current.connect(targetId, { reliable: true })
        setupDataConnection(conn)
    }

    function endCall() {
        mediaRef.current?.getTracks()?.forEach((t) => t.stop())
        setStreamActive(false)
    }

    function toggleMute() {
        const tracks = mediaRef.current?.getAudioTracks?.() || []
        for (const t of tracks) t.enabled = !t.enabled
        setMuted(tracks.length ? !tracks[0].enabled : !muted)
    }


    function sendMessage() {
        if (!msgInput.trim() || !connRef.current?.open) return
        
        const message = {
            type: 'message',
            text: msgInput,
            sender: label || 'Anonymous',
            timestamp: Date.now()
        }
        
        connRef.current.send(message)
        
        setMessages((msgs) => [...msgs, {
            text: msgInput,
            sender: label || 'Anonymous',
            timestamp: Date.now(),
            isMe: true
        }])
        
        pushLog(`You sent: ${msgInput}`)
        setMsgInput('')
    }

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // Room code functions
    function generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let result = ''
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    function createRoom() {
        const newRoomCode = generateRoomCode()
        setRoomCode(newRoomCode)
        pushLog(`Room created: ${newRoomCode}`)
        
        // Add to recent rooms
        const roomEntry = {
            code: newRoomCode,
            timestamp: Date.now(),
            participants: [myId]
        }
        setRecentRooms(prev => [roomEntry, ...prev.filter(r => r.code !== newRoomCode)].slice(0, 10))
    }

    function joinRoom() {
        if (!roomCode.trim()) return
        pushLog(`Joining room: ${roomCode}`)
        
        // Add to recent rooms
        const roomEntry = {
            code: roomCode,
            timestamp: Date.now(),
            participants: [myId]
        }
        setRecentRooms(prev => [roomEntry, ...prev.filter(r => r.code !== roomCode)].slice(0, 10))
    }

    function selectRecentRoom(room) {
        setRoomCode(room.code)
        setShowRecentRooms(false)
    }

    function removeRecentRoom(roomCode) {
        setRecentRooms(prev => prev.filter(r => r.code !== roomCode))
    }

    // Enhanced presence broadcasting
    function broadcastPresence() {
        const entry = { 
            id: myId, 
            label: label || 'Anonymous', 
            roomCode: roomCode || null,
            ts: Date.now() 
        }
        if (connRef.current?.open) {
            connRef.current.send({ type: 'presence', payload: [entry] })
            pushLog('Presence sent')
        } else {
            pushLog('No data connection to send presence')
        }
    }

    const connectDisabled = !peerIdInput || status !== 'ready'
    const shareableUrl = myId ? `${window.location.origin}${window.location.pathname}?peer=${myId}` : ''
    const qrUrl = myId ? generateQR(shareableUrl) : ''

    return (

        <div className="app">
            <style>{`
                .app {
                    min-height: 100vh;
                    background: #0f172a;
                    color: #e2e8f0;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .main-container {
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .card {
                    background: #1e293b;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                    margin-bottom: 20px;
                }
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    margin-top: 24px;
                }
                .left-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .right-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                @media (max-width: 1024px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .h {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                    color: #f1f5f9;
                }
                .badge {
                    background: #334155;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                }
                .badge.small {
                    font-size: 11px;
                    padding: 4px 8px;
                }
                .row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .grow {
                    flex: 1;
                }
                .small {
                    font-size: 13px;
                    color: #94a3b8;
                    margin-bottom: 4px;
                }
                .mono {
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    background: #0f172a;
                    padding: 8px;
                    border-radius: 6px;
                    margin-top: 4px;
                }
                button {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                button:hover:not(:disabled) {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                button.secondary {
                    background: #475569;
                }
                button.secondary:hover:not(:disabled) {
                    background: #334155;
                }
                button.primary {
                    background: #10b981;
                }
                button.primary:hover:not(:disabled) {
                    background: #059669;
                }
                button.danger {
                    background: #ef4444;
                }
                button.danger:hover:not(:disabled) {
                    background: #dc2626;
                }
                input {
                    background: #0f172a;
                    border: 1px solid #334155;
                    color: #e2e8f0;
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 14px;
                    width: 100%;
                }
                input:focus {
                    outline: none;
                    border-color: #3b82f6;
                }
                .controls-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                @media (max-width: 768px) {
                    .controls-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #334155;
                    padding-bottom: 8px;
                }
                .list {
                    max-height: 200px;
                    overflow-y: auto;
                    background: #0f172a;
                    padding: 12px;
                    border-radius: 6px;
                }
                .list::-webkit-scrollbar {
                    width: 6px;
                }
                .list::-webkit-scrollbar-track {
                    background: #1e293b;
                }
                .list::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 3px;
                }
                ul {
                    margin: 8px 0;
                    padding-left: 20px;
                }
                li {
                    margin: 4px 0;
                }
                .chat-container {
                    background: #0f172a;
                    border-radius: 8px;
                    padding: 16px;
                    height: 400px;
                    display: flex;
                    flex-direction: column;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .chat-messages::-webkit-scrollbar {
                    width: 6px;
                }
                .chat-messages::-webkit-scrollbar-track {
                    background: #1e293b;
                }
                .chat-messages::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 3px;
                }
                .message {
                    padding: 8px 12px;
                    border-radius: 8px;
                    max-width: 70%;
                    word-wrap: break-word;
                }
                .message.me {
                    background: #3b82f6;
                    align-self: flex-end;
                    margin-left: auto;
                }
                .message.other {
                    background: #334155;
                    align-self: flex-start;
                }
                .message-sender {
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 2px;
                    opacity: 0.8;
                }
                .message-text {
                    font-size: 14px;
                }
                .message-time {
                    font-size: 10px;
                    opacity: 0.6;
                    margin-top: 2px;
                }
                .chat-input-container {
                    display: flex;
                    gap: 8px;
                }
                .chat-input {
                    flex: 1;
                }
            `}</style>
            
            {/* availability Status Section  */}
<div className="card" style={{ marginTop: 16, padding: 16 }}>
  <div className="small" style={{ marginBottom: 8 }}>Your Availability</div>
 <StatusSelector
  status={status}
  onChange={(newStatus) => {
    setStatus(newStatus);
    localStorage.setItem("peer.status", newStatus);

    // Broadcast to all connected peers
    peers.forEach((p) => {
      const conn = connRef.current[p.id];
      if (conn && conn.open) {
        conn.send({ type: "status-update", status: newStatus });
      }
    });
  }}
/>

</div>




            <div className="card">
                <div className="header">
                    <h2 className="h">Local P2P Voice Chat</h2>
                    <div className="badge small">WebRTC via PeerJS</div>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
    <div className="grow">
        <div className="small">Your Peer ID</div>
        <div className="mono" style={{ wordBreak: 'break-all' }}>{myId || 'Starting…'}</div>
    </div>

    <button className="secondary" onClick={() => copy(myId)} disabled={!myId}>Copy ID</button>
    <button className="secondary" onClick={() => setShowQR(!showQR)} disabled={!myId}>
        {showQR ? 'Hide QR' : 'Show QR'}
    </button>

    {/* Screen Share Button */}
    <button
        className="primary"
        onClick={toggleScreenShare}
        disabled={!connected || streamActive}
    >
        {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
    </button>
</div>


                {showQR && myId && (
                    <div className="card" style={{ marginTop: 16, padding: 16, textAlign: 'center' }}>
                        <div className="small" style={{ marginBottom: 8 }}>Scan this QR code to share your Peer ID</div>
                        <img src={qrUrl} alt="QR Code" style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }} />
                        <div className="small" style={{ marginTop: 8, opacity: 0.7, wordBreak: 'break-all' }}>
                            {shareableUrl}
                        </div>
                        <button className="secondary" onClick={() => copy(shareableUrl)} style={{ marginTop: 8 }}>
                            Copy Shareable URL
                        </button>
                    </div>
                )}

                {/* Room Code Section */}
                <div className="card" style={{ marginTop: 16, padding: 16 }}>
                    <div className="small" style={{ marginBottom: 8 }}>Room Management</div>
                    <div className="row" style={{ marginBottom: 12 }}>
                        <div className="grow">
                            <input 
                                placeholder="Enter room code (6 characters)" 
                                value={roomCode} 
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                        <button onClick={createRoom} className="primary" disabled={status !== 'ready'}>
                            Create Room
                        </button>
                        <button onClick={joinRoom} className="secondary" disabled={!roomCode.trim() || status !== 'ready'}>
                            Join Room
                        </button>
                    </div>
                    
                    {recentRooms.length > 0 && (
                        <div>
                            <div className="row" style={{ marginBottom: 8 }}>
                                <div className="small">Recent Rooms</div>
                                <button 
                                    className="secondary" 
                                    onClick={() => setShowRecentRooms(!showRecentRooms)}
                                    style={{ fontSize: '12px', padding: '4px 8px' }}
                                >
                                    {showRecentRooms ? 'Hide' : 'Show'} ({recentRooms.length})
                                </button>
                            </div>
                            
                            {showRecentRooms && (
                                <div className="list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {recentRooms.map((room, i) => (
                                        <div key={i} className="peer" style={{ marginBottom: '8px' }}>
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{room.code}</div>
                                                <div className="small">
                                                    {new Date(room.timestamp).toLocaleDateString()} {new Date(room.timestamp).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <div className="row" style={{ gap: '4px' }}>
                                                <button 
                                                    onClick={() => selectRecentRoom(room)}
                                                    className="secondary"
                                                    style={{ fontSize: '12px', padding: '4px 8px' }}
                                                >
                                                    Use
                                                </button>
                                                <button 
                                                    onClick={() => removeRecentRoom(room.code)}
                                                    className="danger"
                                                    style={{ fontSize: '12px', padding: '4px 8px' }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid" style={{ marginTop: 16 }}>
                    <div className="card" style={{ padding: 16 }}>
                        <div className="small">1) Enter a friend's Peer ID</div>
                        <div className="row" style={{ marginTop: 8 }}>
                            <input className="grow" placeholder="peer-id to connect" value={peerIdInput} onChange={(e) => setPeerIdInput(e.target.value)} />
                            <button disabled={connectDisabled} onClick={() => connectData(peerIdInput)} className="primary">Connect</button>
                        </div>
                        <div className="small" style={{ marginTop: 8 }}>After connecting data channel, press Call to start audio.</div>
                        <div className="row" style={{ marginTop: 10 }}>
                            <button disabled={!connected} onClick={() => callPeer(peerIdInput)} className="primary">Call</button>
                            <button disabled={!streamActive} onClick={endCall} className="danger">End Call</button>
                            <button disabled={!streamActive} onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>

                            <button onClick={startScreenShare} disabled={!connected || sharingScreen} className="secondary">Start Screen Share</button>
                            <button onClick={stopScreenShare} disabled={!sharingScreen} className="secondary">Stop Screen Share</button>
                        </div>

                    <div className="row" style={{ marginTop: 10 }}>
    <button
        className="secondary"
        onClick={startScreenShare}
        disabled={!connected || sharingScreen}
    >
        {sharingScreen ? 'Sharing...' : 'Share Screen'}
    </button>
    <button
        className="secondary"
        onClick={stopScreenShare}
        disabled={!sharingScreen}
    >
        Stop Sharing
    </button>
</div>

                    </div>

                    {/* Screen Share Display Card */}
<div className="card" style={{ padding: 16, marginTop: 16 }}>
    <div className="small">Shared Screen</div>
    {remoteScreenStream ? (
        <video
            ref={remoteScreenRef}
            autoPlay
            playsInline
            style={{ width: '100%', borderRadius: '8px', marginTop: '8px' }}
        />
    ) : (
        <div className="small" style={{ opacity: 0.5, marginTop: 8 }}>
            No screen being shared yet.
        </div>
    )}
</div>

                    <div className="card" style={{ padding: 16 }}>
                        <div className="small">Status</div>
                        <div className="row" style={{ marginTop: 6, gap: 6 }}>
                            <div className="badge">{status}</div>
                            <div className="badge">{connected ? 'data: connected' : 'data: idle'}</div>
                            <div className="badge">{streamActive ? 'audio: on' : 'audio: off'}</div>
                        </div>
                        <div className="small" style={{ marginTop: 10 }}>Label (name shown to peers)</div>
                        <input placeholder="Your display name" value={label} onChange={(e) => setLabel(e.target.value)} />
                        <div className="row" style={{ marginTop: 10 }}>
                            <button onClick={broadcastPresence} disabled={!connected} className="secondary">Broadcast presence</button>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16, padding: 16 }}>
                    <div className="small" style={{ marginBottom: 8 }}>Text Chat</div>
                    <div className="chat-container">
                        <div className="chat-messages">
                            {messages.length === 0 ? (
                                <div className="small" style={{ textAlign: 'center', opacity: 0.5, marginTop: 'auto', marginBottom: 'auto' }}>
                                    No messages yet. Connect with a peer to start chatting!
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={`message ${msg.isMe ? 'me' : 'other'}`}>
                                        <div className="message-sender">{msg.sender}</div>
                                        <div className="message-text">{msg.text}</div>
                                        <div className="message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="chat-input-container">
                            <input 
                                className="chat-input" 
                                placeholder={connected ? "Type a message..." : "Connect to a peer first"} 
                                value={msgInput} 
                                onChange={(e) => setMsgInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={!connected}
                            />
                            <button onClick={sendMessage} disabled={!connected || !msgInput.trim()} className="primary">
                                Send
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16, padding: 16 }}>
                    <audio ref={audioRef} autoPlay playsInline />
                </div>

                {/* Presence Display Section */}
<div className="card" style={{ marginTop: 16, padding: 16 }}>
  <div className="small" style={{ marginBottom: 8 }}>Connected Peers</div>
  {peers.length === 0 ? (
    <div className="small" style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>
      No peers connected. Share your Peer ID or room code to connect with others.
    </div>
  ) : (
    <div className="list">
      {peers.map((peer, i) => (
        <div key={i} className="peer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 500 }}>
              {peer.label || 'Anonymous'} 
              {peer.roomCode && (
                <span className="badge small" style={{ marginLeft: '8px', backgroundColor: '#3b82f6' }}>
                  Room: {peer.roomCode}
                </span>
              )}
            </div>
            <div className="small" style={{ fontFamily: 'monospace' }}>
              {peer.id}
            </div>
            <div className="small" style={{ opacity: 0.7 }}>
              Last seen: {new Date(peer.ts).toLocaleTimeString()}
            </div>
          </div>

          {/* Dynamic Status Badge */}
<div
  className="badge small"
  style={{
    backgroundColor: getStatusColor(peerStatuses[peer.id]),
    color: 'white',
    padding: '2px 8px',
    borderRadius: '6px',
    fontWeight: 500,
  }}
>
  {peerStatuses[peer.id]?.toUpperCase() || 'ONLINE'}
</div>

        </div>
      ))}
    </div>
  )}
</div>


                <div className="card" style={{ marginTop: 16, padding: 16 }}>
                    <div className="small" style={{ marginBottom: 8 }}>Log</div>
                    <div className="list">
                        {log.map((ln, i) => (
                            <div key={i} className="small" style={{ opacity: .9 }}>{ln}</div>
                        ))}
                    </div>
                </div>

                <div className="small" style={{ marginTop: 16, opacity: .75 }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>📋 Getting Started Guide:</div>
                    <ul>
                        <li><strong>Room Codes:</strong> Create or join a room with a 6-character code for easier group coordination.</li>
                        <li><strong>Peer ID Exchange:</strong> Share your Peer ID manually or use QR codes. Works best on same Wi-Fi network.</li>
                        <li><strong>Connection Limits:</strong> Direct P2P connections work best with 2-4 people. For larger groups, consider multiple rooms.</li>
                        <li><strong>Network Requirements:</strong> Audio is end-to-end encrypted via WebRTC. Very strict NATs may block audio.</li>
                        <li><strong>Offline Support:</strong> App works offline for cached content and local P2P connections.</li>
                    </ul>
                    
                    <div style={{ fontWeight: '600', marginTop: '12px', marginBottom: '8px' }}>⚠️ Manual ID Exchange Limitations:</div>
                    <ul>
                        <li>Peer IDs are long and complex - use QR codes or room codes for easier sharing</li>
                        <li>Each connection requires manual setup - no automatic discovery</li>
                        <li>Works best on same network (Wi-Fi/LAN) for optimal performance</li>
                        <li>Maximum recommended: 4-6 participants per room for stable connections</li>
                        <li>Corporate networks may block PeerJS signaling - try mobile hotspot if needed</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}