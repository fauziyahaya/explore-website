# Avatar FAQ Kiosk

A touch-screen kiosk where a virtual assistant reads out answers to a fixed FAQ (one-way: visitors tap, the avatar speaks).

## Run
Open `index.html` in Chrome or Edge. For a kiosk display: `chrome --kiosk --autoplay-policy=no-user-gesture-required path/to/index.html`

## Customise (only edit `faq-data.js`)
- `KIOSK_CONFIG.org` – organisation name, tagline, logo path, website
- `KIOSK_CONFIG.avatar` – assistant name, role, `image` (put a transparent PNG photo in `assets/` to replace the illustrated avatar), voice speed and pitch
- `KIOSK_FAQ` – topics (icon, title, subtitle) and their questions/answers, in both BM and EN

## Voice
Answers are spoken with the browser's built-in text-to-speech. For Bahasa Melayu, the device needs a Malay (ms-MY) voice. Without one, the kiosk uses an Indonesian voice, or the default voice if that is missing too. Windows: Settings → Time & Language → Speech → add "Bahasa Melayu". Write numbers as words in the answers (e.g. "empat belas hari") so they are read out correctly.

The kiosk returns to the home screen after `idleTimeoutSec` seconds without a touch.
