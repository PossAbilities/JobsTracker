# Ta-Da! ✦

**A to-*da* list, not a to-do list.** An ADHD-friendly evidence diary for your iPhone.

Sick of "you never did X" / "I definitely told you Y"? Ta-Da! is built for exactly that:

- **⚡ One-tap logging** — big customisable buttons ("Picked up her clothes", "Put the washing away"…). Tap it, and it's on the record with the exact date and time. Undo if you fat-finger it.
- **🎙️ Voice notes with live transcription** — push to record, like Otter. It transcribes as you talk (using your iPhone's built-in speech recognition), and you tap a name chip — **Me** / **Wife** — to label who's speaking. Every line of the transcript is stamped with the speaker and the time.
- **🗂️ The diary** — everything grouped by day, searchable, with audio playback. "Today", "Yesterday", and back through time.
- **📷 Photo evidence** — snap a photo as you log it (camera button on the Log tab), or add photos to any existing entry later from its ⋯ menu. Tap a thumbnail to view full-screen.
- **📂 Import a recording** — iOS won't let a web app record with the screen locked, so for discreet/long captures record in Apple's **Voice Memos** app (which works locked and in your pocket), then import the file into the Record tab. It becomes a diary entry with its original date/time, a title, speaker tags and notes.
- **🧾 Receipts on demand** — share any day (or single entry) as a tidy text summary: *"✓ 07:42 — Took the bins out"*. Case closed.
- **🔒 Private by design** — everything (entries, audio, transcripts) is stored only on your phone. Nothing is uploaded anywhere. Works offline.

## Get it on your iPhone (about 2 minutes)

Ta-Da! is a web app that installs like a native app — no App Store needed.

1. **Turn on GitHub Pages** for this repo: go to **Settings → Pages**, and under *Build and deployment* set **Source** to **GitHub Actions**. (If a "Deploy Ta-Da!" action has already run successfully under the *Actions* tab, this is done.)
2. Open the app's URL in **Safari** on your iPhone — it will be
   `https://<your-github-username>.github.io/JobsTracker/`
3. Tap the **Share** button (the square with the arrow), then **Add to Home Screen**.
4. Done. It now opens full-screen from your home screen like any other app, works offline, and keeps all data on the phone.

> **First recording:** Safari will ask for microphone permission — tap Allow. If live transcription doesn't start, check *Settings → Apps → Safari → Microphone* and *Siri & Dictation* are enabled. Even if transcription is unavailable, the audio always records and saves.

## Siri, the Action button & iOS Shortcuts

The app supports deep links and understands dictated speech, so the Shortcuts app can drive it hands-free:

- `https://<user>.github.io/JobsTracker/?log=<anything>` — logs it instantly. Spoken filler is stripped ("can you log that I've just done the dishes" → "Done the dishes") and text that matches a quick button logs as that button.
- `https://<user>.github.io/JobsTracker/?record=1` — jumps straight into recording (evidence mode). If iOS insists on a tap first, the big red button is one tap away.
- `https://<user>.github.io/JobsTracker/?tab=record|diary|settings` — opens on that tab.

**Voice-log shortcut:** New shortcut → **Dictate Text** → **Open URL** with `...?log=` followed by the *Dictated Text* variable. Name it "Log it" — then the Action button / Back Tap / "Hey Siri, log it" lets you speak an entry.

**Evidence shortcut:** New shortcut → **Open URL** → `...?record=1`.

**One button for both:** New shortcut → **Choose from Menu** ("Log something" / "Record conversation") → put the recipes above in the two branches → assign to the Action button.

⚠️ One iOS quirk: URLs opened from Shortcuts open in **Safari**, and iOS keeps Safari's data separate from the installed home-screen app's data. Either use Ta-Da! in Safari as your main copy (fully automatic), or keep the installed app and use this variant instead: shortcut = **Dictate Text → Copy to Clipboard → Open App (Ta-Da!)**, then tap the **📋 button** on the Log tab — it reads the clipboard, cleans it up and logs it into the installed app.

Apple Watch: watchOS can't open web links, so true watch logging needs a native app — not possible with this web app.

## Tips

- **Edit the quick buttons** with the pencil icon (top-right of the Log tab) — rename, re-icon, delete, or add your own.
- **Rename the speakers** in Settings (e.g. put your actual names in). Add more for the kids, the mother-in-law…
- **Back it up** now and then from Settings → *Export diary* (audio stays on the device; text entries and transcripts are included).

## Development

No build step, no dependencies — plain HTML/CSS/JS.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Note: microphone and speech recognition require a secure context (HTTPS or localhost).

| File | What it is |
|---|---|
| `index.html` | App shell and all four screens |
| `style.css` | The design system (dark, calm, big touch targets) |
| `app.js` | Logging, recorder + transcription, diary, storage (IndexedDB), export |
| `sw.js` | Service worker — offline support |
| `manifest.webmanifest` | PWA manifest (name, icons, standalone display) |
