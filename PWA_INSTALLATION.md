# PWA Installation Guide

PeerChat is now a Progressive Web App (PWA)! This means you can install it on your device and use it like a native app.

## 🚀 Installation Steps

### 📱 **Android (Chrome/Edge)**

1. **Open the app** in Chrome or Edge browser
2. **Look for the install prompt** - You'll see a banner at the bottom saying "Add PeerChat to Home screen"
3. **Tap "Add"** or "Install" when prompted
4. **Alternative method**: 
   - Tap the **three dots menu** (⋮) in the browser
   - Select **"Add to Home screen"** or **"Install app"**
   - Tap **"Add"** to confirm

### 🍎 **iOS (Safari)**

1. **Open the app** in Safari browser
2. **Tap the Share button** (square with arrow pointing up)
3. **Scroll down** and tap **"Add to Home Screen"**
4. **Customize the name** if desired (default: "PeerChat")
5. **Tap "Add"** in the top right corner

### 💻 **Desktop (Chrome/Edge/Firefox)**

#### Chrome/Edge:
1. **Open the app** in Chrome or Edge
2. **Look for the install icon** (⊕) in the address bar
3. **Click the install icon** or look for "Install PeerChat" in the menu
4. **Click "Install"** when prompted

#### Firefox:
1. **Open the app** in Firefox
2. **Click the three lines menu** (☰)
3. **Select "Install"** from the menu
4. **Click "Allow"** when prompted

## ✨ PWA Features

### **What You Get:**
- 🏠 **App-like experience** - No browser UI, full screen
- 📱 **Home screen icon** - Quick access from your device
- ⚡ **Faster loading** - Cached for offline use
- 🔄 **Auto-updates** - Always get the latest version
- 📶 **Offline support** - Works without internet (limited features)

### **Offline Capabilities:**
- View previous chat history
- Access app settings
- Local P2P connections (same network)
- Browse cached content

## 🛠️ Technical Details

### **Service Worker Features:**
- **Auto-update**: App updates automatically in the background
- **Offline fallback**: Shows offline page when no internet
- **Smart caching**: Caches PeerJS and QR code services
- **Background sync**: Syncs when connection is restored

### **Manifest Features:**
- **Standalone display**: Runs like a native app
- **Theme colors**: Matches your app's dark theme
- **App shortcuts**: Quick access to voice chat
- **Multiple icon sizes**: Optimized for all devices

## 🔧 Troubleshooting

### **Installation Issues:**

**Android:**
- Make sure you're using Chrome or Edge
- Check if "Add to Home screen" is enabled in browser settings
- Try refreshing the page and trying again

**iOS:**
- Must use Safari (not Chrome or other browsers)
- iOS 11.3+ required for PWA support
- Make sure JavaScript is enabled

**Desktop:**
- Chrome 68+, Edge 79+, or Firefox 58+ required
- Make sure the site is served over HTTPS
- Check if pop-ups are blocked

### **App Not Working Offline:**
- Clear browser cache and reinstall
- Check if service worker is registered (DevTools > Application > Service Workers)
- Make sure you're not in private/incognito mode

### **Updates Not Working:**
- Force refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Clear app data and reinstall
- Check browser console for service worker errors

## 📋 Requirements

### **Browser Support:**
- ✅ Chrome 68+ (Android, Desktop)
- ✅ Edge 79+ (Android, Desktop)
- ✅ Safari 11.3+ (iOS, macOS)
- ✅ Firefox 58+ (Desktop)
- ❌ Internet Explorer (not supported)

### **Device Requirements:**
- **Android**: 5.0+ (API level 21+)
- **iOS**: 11.3+
- **Desktop**: Windows 10+, macOS 10.13+, Linux

## 🎯 Pro Tips

1. **Bookmark the app** for easy access before installing
2. **Enable notifications** for better user experience
3. **Use on same network** for best P2P performance
4. **Keep browser updated** for latest PWA features
5. **Check permissions** - allow microphone access for voice chat

## 🆘 Need Help?

If you're having trouble installing or using the PWA:

1. **Check browser compatibility** above
2. **Try a different browser** (Chrome recommended)
3. **Clear browser cache** and try again
4. **Check device storage** - ensure you have enough space
5. **Restart your device** and try again

---

**Enjoy your new PWA experience with PeerChat! 🎉**
