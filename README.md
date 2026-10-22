# Warnet Tycoon

An idle and management game about running an Indonesian internet cafe. It is a static site (HTML, CSS, JS, no build step, no network calls) that installs on an iPhone as a home-screen app and runs with no connection at all.

Repo: https://github.com/RafiAlaydrus/WarnetTycoon

## Deploy to GitHub Pages

Do this once, while you still have internet.

```bash
cd WARNET
git remote add origin https://github.com/RafiAlaydrus/WarnetTycoon.git
git push -u origin main
```

Then in the repo on GitHub: **Settings, Pages, Build and deployment, Source: Deploy from a branch, Branch: `main`, folder `/ (root)`, Save.** After a minute or two the game is live at:

```
https://rafialaydrus.github.io/WarnetTycoon/
```

All paths in the project are relative, so the `/WarnetTycoon/` subpath works without changes.

## Install on iPhone (do this before the flight)

1. Open the URL above in **Safari** (not Chrome or an in-app browser).
2. Wait for the shop screen to appear. The first load downloads and caches every file.
3. Tap **Share**, then **Add to Home Screen**, then **Add**.
4. Open the game from the new home-screen icon once while still online.
5. Turn on airplane mode and open it again. It should load and play normally.

Things worth knowing on the plane:

- Sound plays through WebAudio, which the iPhone silent switch mutes. Flip the switch or use the mute toggle in Settings.
- Saves live in the app's local storage and are written every 5 seconds and whenever the app is hidden. Use **Settings, Export save text** to keep a copy somewhere safe (Notes works). **Import save text** restores it.
- If the app was closed for a while, the shop pays out offline earnings on reopen: half speed, capped at 2 hours (raise the cap with the Cash drawer upgrade).

## How the game plays

- Customers arrive by time of day, take a free PC, play, and pay per hour at your billing rate. If every PC is busy they queue at the door and leave when they run out of patience.
- Four customer types: Pelajar (after school, cheap, any PC), Gamer (evening and night, long sessions, need Gaming Mid or better), Pekerja (daytime, pay for printing once you own a printer), Streamer (unlocked by contract, need an RTX Rig or better and fast internet).
- Trade-offs: a higher billing rate pays more per hour but fewer people come and they leave grumpier. Internet bandwidth is shared by every busy PC, and the room heats up as PCs run. Past 100% on the Net or Heat bar, satisfaction drops. Stars come from satisfaction and decide how many customers arrive.
- Tap a broken PC to repair it. Tap a snack tag on a desk to serve it. Tap Start genset during a PLN blackout. Staff (Operator, Teknisi, Penjual, Cleaner) automate these.
- **Buka Cabang** resets the shop and keeps Franchise points (+5% income each) and achievements.

## Debug mode

Add `?debug=1` to the URL for 10x speed and a **+Rp 1M** button.

```
https://rafialaydrus.github.io/WarnetTycoon/?debug=1
```

It also exposes `window.WT` in the console. The normal URL has none of this.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, tab bar, dialog element |
| `style.css` | All styling, design tokens at the top |
| `game.js` | Simulation, UI, audio, save and load |
| `sw.js` | Service worker: caches every file on install, cache-first |
| `manifest.json` | Home-screen app metadata |
| `icons/` | 192 and 512 PNG, plus the 180 apple-touch icon |
| `DESIGN.md` | Visual direction and the reason behind each choice |

## Changing the game later

- Any change to a cached file needs a new `VERSION` string in `sw.js`, otherwise installed copies keep serving the old files. After deploying, open the app online twice so the new version takes over.
- Balance numbers (costs, arrival rates, `PRESTIGE_T`) are constants at the top of `game.js`.
- The icons are plain generated placeholders (an awning over a monitor). Replace the three PNGs in `icons/` with your own artwork if you have a logo.
