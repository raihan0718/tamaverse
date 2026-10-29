# TAMAVERSE

TAMAVERSE is a mobile-first, no-login virtual pet RPG prototype built with plain HTML, CSS, and JavaScript. It has no paid services, package installs, or API keys.

## Run it

- In Replit, start the project preview. The project serves `index.html`.
- To run it on a computer with Python, use `python3 -m http.server 5000 --bind 0.0.0.0`, then open the server's page in a browser.
- On Android, use the Replit preview or open the hosted project URL in your browser. Use the same browser each time; progress is saved in that browser's `localStorage`.

Do not clear the browser's site data if you want to keep your save. Clearing it removes the local guest profile and game progress.

## Prototype limits

The guest ID, pets, gacha, battles, rating, and sample ranking are local-only and can be edited in the browser. They are not secure accounts, online multiplayer, or a global leaderboard. Real shared progress and competitive rewards require a trusted backend.

The app detects Telegram's Mini App bridge when Telegram provides it, but it does not implement Telegram login, bots, matchmaking, or server validation.

## Main files

- `index.html` — app shell and navigation
- `styles.css` — responsive interface and animations
- `script.js` — game rules, local save, pets, gacha, quests, and battles
