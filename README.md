# PeerChat - P2P Voice Chat (React + Vite + WebRTC + PWA)

A zero-backend, end-to-end encrypted voice chat for people on the same Wi‑Fi (or over the internet) using WebRTC and PeerJS. Now with PWA support for installable, offline-capable experience!

- Frontend: React + Vite
- Signaling: PeerJS public cloud broker (0.peerjs.com)
- Media: WebRTC (DTLS-SRTP, E2E encrypted)
- PWA: Installable, offline support, auto-updates
- Hosting: GitHub Pages (static)

## 🚀 Quick start (local)

1. Install Node.js 18+.
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open the printed URL (e.g., http://localhost:5173). Note: getUserMedia (microphone) requires a secure context. It works on localhost but not over plain HTTP LAN IPs. For cross-device testing, deploy to GitHub Pages (HTTPS) or run Vite with HTTPS locally.

## 📱 PWA Installation

PeerChat is now a Progressive Web App! Install it on your device for a native app experience:

- **Android**: Chrome/Edge → Menu → "Add to Home screen"
- **iOS**: Safari → Share → "Add to Home Screen"  
- **Desktop**: Chrome/Edge → Install icon in address bar

See [PWA_INSTALLATION.md](./PWA_INSTALLATION.md) for detailed installation steps.

## How to use

1. Each user opens the app; it shows their Peer ID.
2. Share your Peer ID with the other user (copy/paste).
3. User A enters User B’s ID and presses Connect (data channel).
4. Press Call to start sending audio. Grant mic permission when prompted.
5. Mute/End as needed.

WebRTC media is encrypted end-to-end. Without your own TURN server, very strict NATs/firewalls may block audio; on the same LAN, it usually works fine.

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this project.
2. Ensure the default branch is `main` (or change the workflow to your branch).
3. In GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions. No further config needed.
4. Push to `main`. The `Deploy Vite site to GitHub Pages` workflow will build and publish to Pages.

If deployment fails with a 404 from deploy-pages, first visit Settings → Pages once to initialize Pages for the repo; then re-run the workflow.

The workflow automatically sets the Vite base path to `/${REPO_NAME}/` so assets load under project pages. If your repo is a user/organization site named `<username>.github.io`, Vite base `/` is fine; you can remove the env override in the workflow.

## Notes and limitations

- This app uses the public PeerJS broker only for signaling. Media flows P2P and is encrypted. For maximum reliability behind symmetric NATs, provide a TURN server in `src/pages/App.jsx` under `iceServers`.
- GitHub Pages is static hosting, so we cannot run our own signaling or TURN here. If you later host on your own domain/server, consider running a local PeerServer and a TURN server.
- Mobile Safari requires a user gesture to autoplay remote audio; tap once if you don’t hear sound.

## Configuration

- Edit `defaultConfig` in `src/pages/App.jsx` to point to a custom PeerServer if needed.
- Add TURN credentials to `iceServers` for better NAT traversal.

## Contribute and issues

Use GitHub Issues to plan and track work. This repo includes templates for:

- Next Steps Tasklist: pre-filled checklist of recommended enhancements
- Feature Request: propose new capabilities
- Good First Issue: small, well-scoped starter tasks

When creating a new issue on GitHub, pick the appropriate template to get started quickly.

## Thankyou-Contributors

<a href="https://github.com/Rohit-554/Peer-Hacktoberfest/graphs/contributors">
	<img src="https://contrib.rocks/image?repo=Rohit-554/Peer-Hacktoberfest" alt="Contributors" />

</a>
