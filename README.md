# Creative Command Center

A personal dashboard for daily reminders, equipment learning, food-truck concepts, goals, and creative work. It can be installed as a Progressive Web App and stores personal data on the current device.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

The GitHub Actions workflow publishes this repository at `https://funagent86.github.io/executive-os/` whenever changes are pushed to `main`.

For the first deployment, open the repository's **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The workflow builds with the project-site base path while local development continues to use `/`. After the workflow finishes, the live site is available at the URL above.

Recipe concepts are stored in IndexedDB. Reminder, training, and journal data are saved in browser storage. The service worker caches the app shell and loaded assets so the dashboard can reopen offline after its first visit.
