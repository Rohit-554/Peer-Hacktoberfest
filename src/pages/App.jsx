import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Peer } from 'peerjs'

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
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
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
  navigator.clipboard?.writeText(text).catch(() => {})
}

export default function App() {
  const [cfg, setCfg] = useLocalStorage('peer.cfg', defaultConfig)
  const [label, setLabel] = useLocalStorage('peer.label', '')
  const [status, setStatus] = useState('idle')
  const [myId, setMyId] = useState('')
  const [peerIdInput, setPeerIdInput] = useState('')
  const [peers, setPeers] = useState([])
  const [log, setLog] = useState([])
  const [muted, setMuted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [streamActive, setStreamActive] = useState(false)

  const peerRef = useRef(null)
  const connRef = useRef(null)
  const mediaRef = useRef(null)
  const audioRef = useRef(null)

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
        const stream = await getMic()
        call.answer(stream)
        setStreamActive(true)
        call.on('stream', (remote) => attachRemoteAudio(remote))
        call.on('close', () => setStreamActive(false))
      } catch (e) {
        pushLog('Mic error: ' + e.message)
      }
    })

    return () => {
      peer.destroy()
      peerRef.current = null
    }
  }, [peerOptions])

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
    audioRef.current.play().catch(() => {})
  }

  function setupDataConnection(conn) {
    connRef.current = conn
    setConnected(true)
    pushLog('Connected to ' + conn.peer)

    conn.on('data', (data) => {
      if (data?.type === 'presence') {
        setPeers((p) => mergePeers(p, data.payload))
      } else if (data?.type === 'signal') {
        // Place for extra messages if needed
      }
    })

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

  function broadcastPresence() {
    const entry = { id: myId, label: label || 'Anonymous', ts: Date.now() }
    if (connRef.current?.open) {
      connRef.current.send({ type: 'presence', payload: [entry] })
      pushLog('Presence sent')
    } else {
      pushLog('No data connection to send presence')
    }
  }

  const connectDisabled = !peerIdInput || status !== 'ready'

  return (
    <div className="app">
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
            </div>
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
          <audio ref={audioRef} autoPlay playsInline />
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
          Tips:
          <ul>
            <li>Both users must open this page and share their Peer IDs to connect.</li>
            <li>Audio is sent end-to-end via WebRTC. Without your own TURN, very strict NATs may block audio.</li>
            <li>Over GitHub Pages, only static hosting is available; we use PeerJS public broker for signalling.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
