#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')


const repoRoot = path.resolve(__dirname, '..')
const certDir = path.join(repoRoot, 'certs')
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir)


const certFile = path.join(certDir, 'localhost.pem')
const keyFile = path.join(certDir, 'localhost-key.pem')


function getLocalIPs() {
const nets = os.networkInterfaces()
const results = []
for (const name of Object.keys(nets)) {
for (const net of nets[name]) {
// we only care about IPv4 external addresses
if (net.family === 'IPv4' && !net.internal) {
results.push(net.address)
}
}
}
return results
}


const localIPs = getLocalIPs()
const hosts = ['localhost', '127.0.0.1', '::1', ...localIPs]


console.log('Generating cert for hosts:', hosts.join(', '))


function run(cmd) {
console.log('> ' + cmd)
execSync(cmd, { stdio: 'inherit' })
}


// Try mkcert first (preferred — mkcert installs a local CA and will make certs trusted by browsers)
try {
execSync('mkcert -version', { stdio: 'ignore' })
console.log('mkcert found — creating locally-trusted certs (mkcert will install a local CA if necessary)')
try { execSync('mkcert -install', { stdio: 'inherit' }) } catch (e) { /* ignore */ }
const mkcertCmd = `mkcert -cert-file "${certFile}" -key-file "${keyFile}" ${hosts.map(h => '"' + h + '"').join(' ')}`
run(mkcertCmd)
console.log('Created certs:')
console.log(' ', certFile)
console.log(' ', keyFile)
process.exit(0)
} catch (e) {
console.log('mkcert not available — falling back to OpenSSL self-signed cert (NOT trusted automatically)')
}


// Fallback: openssl (self-signed, will trigger browser warnings unless imported into trust stores)
try {
const subj = '/CN=localhost'
const opensslCmd = `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyFile}" -out "${certFile}" -days 365 -subj "${subj}"`
run(opensslCmd)
console.log('Created self-signed certs:')
console.log(' ', certFile)
console.log(' ', keyFile)
console.log('\nNote: This self-signed certificate will NOT be trusted by browsers automatically. Use mkcert if you want a trusted cert. See HTTPS_SETUP.md for instructions.')
process.exit(0)
} catch (err) {
console.error('Failed to create certificates. Make sure you have `mkcert` or `openssl` installed.\nError: ', err && err.message)
process.exit(1)
}
