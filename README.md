# 💍 AR Wedding Invitation (WebAR)

A no-app, in-browser **augmented reality** wedding invitation. Guests open a link on
their phone, point the camera at the floor (or any flat surface), tap, and a 3D
invitation — animated rings, floating names, falling petals, rising hearts, music,
and RSVP/Directions buttons — appears in their room, Pokémon GO style.

## Files
- `index.html` — cover page + AR overlay UI
- `app.js` — Three.js + WebXR experience (edit your details at the top)

## ✏️ Customize
Open `app.js` and edit the `CONFIG` block at the very top:
```js
const CONFIG = {
  name1: 'Alex',
  name2: 'Jordan',
  dateText: 'September 12, 2026',
  venue: 'Sunset Garden Estate',
  rsvpUrl: 'https://example.com/rsvp',
  mapUrl:  'https://maps.google.com/?q=...',
  musicUrl: '',   // optional: './music.mp3' — leave '' for built-in soft chimes
};
```
To use your own song or voice message, drop an `.mp3` next to these files and set
`musicUrl: './music.mp3'`.

## ▶️ Run it
WebAR **requires HTTPS** (or `localhost`). It will NOT work from a `file://` path.

**Quick local test (desktop preview):**
```powershell
cd c:\Users\divyamsingh\ar-wedding-invitation
python -m http.server 8000
# open http://localhost:8000
```
On desktop you'll see the interactive 3D preview (drag to rotate).

**To test real AR on your phone**, the page must be served over HTTPS. Easiest options:
- **ngrok:** `ngrok http 8000` → open the `https://…` link on your phone, or
- Deploy the folder to any static host (see below) and open it on your phone.

## 🚀 Free hosting (gives you a shareable HTTPS link)
Upload these two files to any of:
- **Netlify Drop** — drag the folder onto https://app.netlify.com/drop
- **GitHub Pages** — push to a repo, enable Pages
- **Vercel / Cloudflare Pages / Firebase Hosting**

Then share the resulting `https://…` link (or a QR code of it) on your invites.

## 📱 Device support
| Device | Experience |
|---|---|
| **Android** (Chrome, with Google Play Services for AR) | Full in-room AR placement |
| **iPhone/iPad (Safari)** | Falls back to an interactive 3D invitation (Safari has no WebXR placement) |
| **Desktop** | Interactive 3D preview |

> Tip for iPhone full-AR: install a WebXR-capable browser, or ask me to add a
> USDZ/Quick Look "view in your space" button for native iOS AR.

## How it works
Uses the **WebXR Device API** (`immersive-ar` + `hit-test`) to detect real-world
surfaces, a reticle to aim, and **DOM Overlay** to show the RSVP/Directions buttons
on top of the camera feed. All 3D content and textures are generated procedurally —
no external 3D model files needed.
