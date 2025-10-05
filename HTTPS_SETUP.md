# HTTPS dev server (LAN testing)
This document explains how to create locally-trusted certificates and run the Vite dev server over HTTPS so you can test the app from other devices on the same LAN (phones, tablets, etc.).

## Recommended approach: use `mkcert` (easiest — certificates are trusted automatically)

### Install mkcert
- macOS (Homebrew):
```
brew install mkcert
brew install nss # for Firefox (optional)
```
- Windows (Chocolatey):
```
choco install mkcert
```
- Linux: download the mkcert binary from the project releases or use your package manager if available. Also install ```libnss3-tools``` for Firefox integration when required.

(See mkcert project for platform-specific install steps.)

### Generate certs (recommended)
```npm run generate-cert```
This script will prefer mkcert. If mkcert is installed it will create a locally-trusted certificate and install a local CA (if needed). The generated files will be placed in ```./certs/localhost.pem``` and ```./certs/localhost-key.pem```.

### Start the dev server
```npm run dev:https```

### Open the site from another device on your LAN using your machine IP, for example:
```https://192.168.1.23:5173```
If the browser still warns about the certificate, confirm ```mkcert -install``` succeeded, or (if using the OpenSSL fallback) ```import certs/localhost.pem``` into the OS/browser trust store (instructions below).

## Fallback: OpenSSL (self-signed)

If you don't have mkcert installed, npm run generate-cert will try to create a self-signed cert with openssl. Self-signed certs will trigger browser warnings unless you import the cert into the trusted root store.
Trusting the self-signed cert (example):
- macOS (Keychain Access)
  1. Open Keychain Access.
  2. File → Import Items → select ```certs/localhost.pem```.
  3. Find the imported cert in login or System keychain, double-click it, expand "Trust" and set "When using this certificate" → "Always Trust".

- Windows
  1. Run certmgr.msc.
  2. Import ```certs/localhost.pem``` into ```Trusted Root Certification Authorities``` → Certificates.

- Linux
 1. Varies by distro/browser. On Debian/Ubuntu you can generally copy the PEM into ```/usr/local/share/ca-certificates/``` and run ```sudo update-ca-certificates```. Firefox may need manual import.

## HMR / websocket problems

If the dev server loads but HMR (hot module replacement) fails in other devices, set DEV_HMR_HOST to your host machine's LAN IP when starting the server. Example:

- macOS / Linux:
```DEV_HMR_HOST=192.168.1.23 npm run dev:https```

- Windows (PowerShell):
```
$env:DEV_HMR_HOST = '192.168.1.23'
npm run dev:https
```
This forces Vite to use that host in the HMR websocket URL.

## Troubleshooting

- If you see ```NET::ERR_CERT_AUTHORITY_INVALID```, your cert is not trusted. Prefer mkcert to avoid this.
- If ```mkcert``` fails to install the local CA, try running ```mkcert -install``` manually (may request admin rights).
- If ```openssl``` is not installed on Windows, use ```mkcert ``` instead, or install OpenSSL via MSYS2 / Git for Windows / other means.

## Security note
Do not commit your private key to the repository. We add certs/ to .gitignore. If you prefer to share a single cert for your team, coordinate explicitly and treat the key as sensitive.
