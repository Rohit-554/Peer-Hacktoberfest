import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Peer } from 'peerjs'
import StatusSelector from "../components/StatusSelector";

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
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    path: '/'
}

function copy(text) {
    navigator.clipboard?.writeText(text).catch(() => { })
}

function generateQR(text, size = 200) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
    return qrUrl
}

export default function App() {
    const [cfg, setCfg] = useLocalStorage('peer.cfg', defaultConfig)
    const [label, setLabel] = useLocalStorage('peer.label', '')
    const [recentRooms, setRecentRooms] = useLocalStorage('peer.recentRooms', [])
    const [userStatus, setUserStatus] = useLocalStorage('peer.status', 'online')
    const [connectionStatus, setConnectionStatus] = useState('idle')
    const [peerStatuses, setPeerStatuses] = useState({})
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
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [remoteScreenStream, setRemoteScreenStream] = useState(null)
    const [sharingScreen, setSharingScreen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const peerRef = useRef(null)
    const connRef = useRef(null)
    const mediaRef = useRef(null)
    const audioRef = useRef(null)
    const chatEndRef = useRef(null)
    const remoteScreenRef = useRef(null)
    const localScreenRef = useRef(null)

    function getStatusColor(status) {
        switch (status) {
            case 'online': return '#10b981';
            case 'away': return '#f59e0b';
            case 'busy': return '#ef4444';
            case 'offline': return '#6b7280';
            default: return '#10b981';
        }
    }

    async function startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setSharingScreen(true);
            localScreenRef.current = stream;
            
            // Make a screen share call to the connected peer
            if (peerRef.current && connRef.current && connRef.current.peer) {
                const call = peerRef.current.call(connRef.current.peer, stream, { metadata: { type: 'screen' } });
                call.on('close', () => {
                    pushLog('Screen share call ended');
                });
                pushLog(`Screen sharing to peer: ${connRef.current.peer}`);
            } else {
                pushLog('No connected peer to share screen with');
            }
            
            stream.getVideoTracks()[0].onended = () => stopScreenShare();
            pushLog('Screen sharing started');
        } catch (err) {
            console.error('Screen share error:', err);
            pushLog('Screen share error: ' + err.message);
            setSharingScreen(false);
        }
    }

    function stopScreenShare() {
        if (localScreenRef.current) {
            localScreenRef.current.getTracks().forEach(track => track.stop());
            localScreenRef.current = null;
        }
        setSharingScreen(false);
        pushLog('Screen sharing stopped');
    }

    const peerOptions = useMemo(() => ({
        host: cfg.host, port: Number(cfg.port), secure: !!cfg.secure, path: cfg.path || '/',
        config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            sdpSemantics: 'unified-plan'
        },
        debug: 1
    }), [cfg])

    useEffect(() => {
        setConnectionStatus('initializing')
        const peer = new Peer(undefined, peerOptions)
        peerRef.current = peer

        peer.on('open', (id) => {
            setMyId(id)
            setConnectionStatus('ready')
            pushLog(`Your ID: ${id}`)
        })

        peer.on('error', (err) => {
            pushLog('Peer error: ' + err.type + ' ' + (err.message || ''))
            if (err.type === 'unavailable-id' || err.type === 'network') setConnectionStatus('error')
        })

        peer.on('connection', (conn) => {
            setupDataConnection(conn)
        })

        peer.on('call', async (call) => {
            try {
                if (call.metadata?.type === 'screen') {
                    call.answer();
                    call.on('stream', (remote) => {
                        setRemoteScreenStream(remote);
                        pushLog('Received screen share stream');
                    });
                    call.on('close', () => {
                        setRemoteScreenStream(null);
                        pushLog('Screen share ended');
                    });
                } else {
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

    useEffect(() => {
        if (remoteScreenRef.current && remoteScreenStream) {
            remoteScreenRef.current.srcObject = remoteScreenStream;
        }
    }, [remoteScreenStream])

    function pushLog(x) { setLog((l) => [x, ...l].slice(0, 200)) }

    async function getMic() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
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

        setTimeout(() => {
            if (conn.open) {
                conn.send({ type: 'status-update', status: userStatus });
            }
        }, 100);

        conn.on('data', (data) => {
            if (!data) return;
            switch (data.type) {
                case 'presence':
                    setPeers((prevPeers) => mergePeers(prevPeers, data.payload));
                    break;
                case 'message':
                    setMessages((msgs) => [...msgs, {
                        text: data.text,
                        sender: data.sender,
                        timestamp: data.timestamp,
                        isMe: false,
                        senderStatus: data.senderStatus || 'online',
                    }]);
                    pushLog(`Message from ${data.sender}: ${data.text}`);
                    break;
                case 'status-update':
                    setPeerStatuses((prev) => ({ ...prev, [conn.peer]: data.status }));
                    pushLog(`Status update from ${conn.peer}: ${data.status}`);
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

        conn.on('open', () => {
            conn.send({ type: 'status-update', status: userStatus });
        });
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
            timestamp: Date.now(),
            senderStatus: userStatus
        }

        connRef.current.send(message)

        setMessages((msgs) => [...msgs, {
            text: msgInput,
            sender: label || 'Anonymous',
            timestamp: Date.now(),
            isMe: true,
            senderStatus: userStatus
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

    const connectDisabled = !peerIdInput || connectionStatus !== 'ready'
    const shareableUrl = myId ? `${window.location.origin}${window.location.pathname}?peer=${myId}` : ''
    const qrUrl = myId ? generateQR(shareableUrl) : ''

    return (
        <div className="app">
            <style>{`
                * {
                    box-sizing: border-box;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    overflow-x: hidden;
                }
                .app {
                    min-height: 100vh;
                    width: 100vw !important;
                    max-width: none !important;
                    background: #0f172a;
                    color: #e2e8f0;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                .main-container {
                    width: 100%;
                    margin: 0;
                    padding: 8px;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                .card {
                    background: #1e293b;
                    border-radius: 8px;
                    padding: 16px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                    margin-bottom: 0;
                }
                .card.compact {
                    padding: 12px;
                }
                .card.fill {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                    padding: 12px 16px;
                }
                .h {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                    color: #f1f5f9;
                }
                .badge {
                    background: #334155;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                }
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 300px 1fr 350px;
                    gap: 16px;
                    margin-bottom: 16px;
                    height: calc(100vh - 120px);
                }
                .left-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .center-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .right-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #f1f5f9;
                    margin-bottom: 12px;
                    border-bottom: 1px solid #334155;
                    padding-bottom: 6px;
                }
                .controls-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .row {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .grow {
                    flex: 1;
                }
                .small {
                    font-size: 13px;
                    color: #94a3b8;
                    margin-bottom: 8px;
                }
                .mono {
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    background: #0f172a;
                    padding: 12px;
                    border-radius: 8px;
                    word-break: break-all;
                }
                button {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    white-space: nowrap;
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
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    width: 100%;
                }
                input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
                    padding: 12px 16px;
                    border-radius: 12px;
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
                    margin-bottom: 4px;
                    opacity: 0.8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .message-text {
                    font-size: 14px;
                    line-height: 1.4;
                }
                .message-time {
                    font-size: 10px;
                    opacity: 0.6;
                    margin-top: 4px;
                }
                .chat-input-container {
                    display: flex;
                    gap: 8px;
                }
                .list {
                    max-height: 200px;
                    overflow-y: auto;
                    background: #0f172a;
                    padding: 12px;
                    border-radius: 8px;
                }
                @media (max-width: 1200px) {
                    .dashboard-grid {
                        grid-template-columns: 280px 1fr;
                        height: auto;
                    }
                    .right-panel {
                        display: none;
                    }
                }
                @media (max-width: 768px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        height: auto;
                    }
                    .controls-grid {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 768px) {
                    .app {
                        padding: 12px;
                    }
                    .card {
                        padding: 16px;
                    }
                    .row {
                        flex-direction: column;
                        align-items: stretch;
                    }
                }
            `}</style>

            <div className="main-container">
                {/* Compact Header */}
                <div className="header">
                    <h1 className="h">PeerChat</h1>
                    <div className="badge">WebRTC P2P Communication</div>
                </div>

                {/* 3-Column Dashboard Grid */}
                <div className="dashboard-grid">
                    {/* Left Panel - Identity & Controls */}
                    <div className="left-panel">
                        {/* Status & Identity */}
                        <div className="card compact">
                            <div className="section-title">Status</div>
                            <StatusSelector
                                status={userStatus}
                                onChange={(newStatus) => {
                                    setUserStatus(newStatus);
                                    if (connRef.current && connRef.current.open) {
                                        connRef.current.send({ type: "status-update", status: newStatus });
                                        pushLog(`Status updated to: ${newStatus}`);
                                    }
                                }}
                            />
                        </div>

                        {/* Peer ID */}
                        <div className="card compact">
                            <div className="section-title">Your ID</div>
                            <div className="mono" style={{ fontSize: '11px', marginBottom: 8 }}>{myId || 'Initializing...'}</div>
                            <div className="row">
                                <button className="secondary" onClick={() => copy(myId)} disabled={!myId} style={{ fontSize: '12px', padding: '8px 12px' }}>
                                    Copy
                                </button>
                                <button className="secondary" onClick={() => setShowQR(!showQR)} disabled={!myId} style={{ fontSize: '12px', padding: '8px 12px' }}>
                                    QR
                                </button>
                            </div>
                        </div>

                        {/* QR Code Display */}
                        {showQR && myId && (
                            <div className="card compact">
                                <div className="section-title">QR Code</div>
                                <div style={{ textAlign: 'center' }}>
                                    <img 
                                        src={qrUrl} 
                                        alt="QR Code" 
                                        style={{ 
                                            width: '150px', 
                                            height: '150px', 
                                            borderRadius: '8px',
                                            background: 'white',
                                            padding: '8px'
                                        }} 
                                    />
                                    <div style={{ fontSize: '10px', opacity: 0.7, marginTop: 8 }}>
                                        Scan to connect
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Connection */}
                        <div className="card compact">
                            <div className="section-title">Connect</div>
                            <input
                                placeholder="Peer ID"
                                value={peerIdInput}
                                onChange={(e) => setPeerIdInput(e.target.value)}
                                style={{ marginBottom: 8, fontSize: '12px' }}
                            />
                            <button
                                disabled={connectDisabled}
                                onClick={() => connectData(peerIdInput)}
                                className="primary"
                                style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                            >
                                Connect
                            </button>
                        </div>

                        {/* Call Controls */}
                        <div className="card compact">
                            <div className="section-title">Call</div>
                            <div className="row" style={{ marginBottom: 8 }}>
                                <button disabled={!connected} onClick={() => callPeer(peerIdInput)} className="primary" style={{ fontSize: '12px', padding: '8px' }}>
                                    Call
                                </button>
                                <button disabled={!streamActive} onClick={endCall} className="danger" style={{ fontSize: '12px', padding: '8px' }}>
                                    End
                                </button>
                            </div>
                            <div className="row">
                                <button disabled={!streamActive} onClick={toggleMute} className="secondary" style={{ fontSize: '12px', padding: '8px' }}>
                                    {muted ? 'Unmute' : 'Mute'}
                                </button>
                                {!sharingScreen ? (
                                    <button
                                        onClick={startScreenShare}
                                        disabled={!connected}
                                        className="secondary"
                                        style={{ fontSize: '12px', padding: '8px' }}
                                    >
                                        Share
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopScreenShare}
                                        className="danger"
                                        style={{ fontSize: '12px', padding: '8px' }}
                                    >
                                        Stop
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Room Management */}
                        <div className="card compact">
                            <div className="section-title">Room</div>
                            <input
                                placeholder="Room code"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{ marginBottom: 8, fontSize: '12px' }}
                            />
                            <div className="row">
                                <button onClick={createRoom} className="primary" disabled={connectionStatus !== 'ready'} style={{ fontSize: '12px', padding: '8px' }}>
                                    Create
                                </button>
                                <button onClick={joinRoom} className="secondary" disabled={!roomCode.trim() || connectionStatus !== 'ready'} style={{ fontSize: '12px', padding: '8px' }}>
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Center Panel - Main Communication */}
                    <div className="center-panel">
                        {/* Screen Share Display */}
                        <div className="card fill">
                            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Shared Screen
                                {remoteScreenStream && (
                                    <button 
                                        onClick={() => setIsFullscreen(!isFullscreen)}
                                        className="secondary"
                                        style={{ fontSize: '10px', padding: '4px 8px' }}
                                    >
                                        {isFullscreen ? 'Exit' : 'Fullscreen'}
                                    </button>
                                )}
                            </div>
                            {remoteScreenStream ? (
                                <video
                                    ref={remoteScreenRef}
                                    autoPlay
                                    playsInline
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    style={{ 
                                        width: '100%', 
                                        height: isFullscreen ? '80vh' : '400px', 
                                        borderRadius: '8px', 
                                        objectFit: 'contain',
                                        cursor: 'pointer',
                                        background: '#000'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    background: '#0f172a',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    textAlign: 'center',
                                    opacity: 0.5,
                                    height: '400px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    No screen being shared
                                </div>
                            )}
                        </div>

                        {/* Text Chat */}
                        {!isFullscreen && (
                            <div className="card">
                                <div className="section-title">Chat</div>
                                <div style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                                <div className="chat-messages" style={{ height: '250px', overflowY: 'auto', marginBottom: 12, padding: '8px', background: '#0f172a', borderRadius: '6px' }}>
                                    {messages.length === 0 ? (
                                        <div style={{
                                            textAlign: 'center',
                                            opacity: 0.5,
                                            padding: '20px',
                                            fontSize: '13px'
                                        }}>
                                            No messages yet
                                        </div>
                                    ) : (
                                        messages.map((msg, i) => (
                                            <div key={i} className={`message ${msg.isMe ? 'me' : 'other'}`} style={{ marginBottom: 8, padding: '8px 12px', borderRadius: '8px', maxWidth: '80%' }}>
                                                <div className="message-sender" style={{ fontSize: '11px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {msg.sender}
                                                    <span
                                                        style={{
                                                            width: '6px',
                                                            height: '6px',
                                                            borderRadius: '50%',
                                                            backgroundColor: getStatusColor(msg.senderStatus || 'online')
                                                        }}
                                                    />
                                                </div>
                                                <div className="message-text" style={{ fontSize: '13px' }}>{msg.text}</div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="chat-input-container">
                                    <input
                                        className="grow"
                                        placeholder={connected ? "Type message..." : "Connect first"}
                                        value={msgInput}
                                        onChange={(e) => setMsgInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        disabled={!connected}
                                        style={{ fontSize: '13px' }}
                                    />
                                    <button onClick={sendMessage} disabled={!connected || !msgInput.trim()} className="primary" style={{ fontSize: '12px', padding: '8px 12px' }}>
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* Right Panel - Status & Peers */}
                    <div className="right-panel">

                        {/* Connection Status */}
                        <div className="card compact">
                            <div className="section-title">Status</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div className="badge" style={{ fontSize: '11px' }}>{connectionStatus}</div>
                                <div className="badge" style={{ fontSize: '11px' }}>{connected ? 'Connected' : 'Disconnected'}</div>
                                <div className="badge" style={{ fontSize: '11px' }}>{streamActive ? 'Audio On' : 'Audio Off'}</div>
                            </div>
                        </div>

                        {/* Display Name */}
                        <div className="card compact">
                            <div className="section-title">Name</div>
                            <input
                                placeholder="Display name"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                style={{ fontSize: '12px' }}
                            />
                        </div>

                        {/* Connected Peers */}
                        <div className="card fill">
                            <div className="section-title">Peers</div>
                            {peers.length === 0 ? (
                                <div style={{
                                    opacity: 0.5,
                                    textAlign: 'center',
                                    padding: '20px',
                                    fontSize: '12px'
                                }}>
                                    No peers connected
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {peers.map((peer, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px',
                                            background: '#0f172a',
                                            borderRadius: '6px'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '12px' }}>
                                                    {peer.label || 'Anonymous'}
                                                </div>
                                                <div className="small" style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                                                    {peer.id?.substring(0, 8)}...
                                                </div>
                                            </div>
                                            <div
                                                className="badge"
                                                style={{
                                                    backgroundColor: getStatusColor(peerStatuses[peer.id]),
                                                    color: 'white',
                                                    fontSize: '10px',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                {peerStatuses[peer.id]?.toUpperCase() || 'ONLINE'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Debug Log */}
                        <div className="card fill">
                            <div className="section-title">Log</div>
                            <div style={{ fontSize: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                                {log.slice(0, 10).map((ln, i) => (
                                    <div key={i} style={{ opacity: 0.7, marginBottom: 2 }}>
                                        {ln}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <audio ref={audioRef} autoPlay playsInline />
            </div>
        </div>
    )
}