# ReelMind 🎬

**Save it now. Find it when you need it.**

ReelMind is an AI-powered video bookmarking application that helps you save, organize, and rediscover Instagram Reels and YouTube videos in one place.

Instead of losing useful videos in endless saved collections, ReelMind automatically categorizes your bookmarks and makes them easy to find.

## Features

- **AI-Powered Organization** — Automatically categorizes videos into relevant categories, subcategories, and tags using Gemini AI.
- **Smart Collections** — Organize bookmarks into multiple folders and nested collections.
- **Chrome Extension** — Save videos directly from your browser.
- **Android PWA** — Share videos directly from Instagram and YouTube to ReelMind.
- **Search & Filters** — Quickly find saved videos.
- **Personalized Workspace** — Multiple themes, wallpapers, and layout preferences.
- **Secure Authentication** — Private user accounts with Supabase Authentication.
- **Cloud Sync** — Access your bookmarks and preferences across devices.

## Tech Stack

| Technology | Purpose |
|---|---|
| React + Vite | Frontend |
| JavaScript + CSS | Application UI |
| Supabase | Authentication, database, storage |
| PostgreSQL + RLS | Secure data management |
| Supabase Edge Functions | Backend functions |
| Google Gemini | AI video classification |
| Chrome Extension | Browser integration |
| Vercel | Deployment |

## Project Structure

```text
reelmind-starter/
├── docs/               # Documentation
├── extension/          # Chrome extension
├── public/             # Static assets and PWA files
├── src/                # React application
├── supabase/           # Supabase configuration and functions
├── .env.example        # Environment variable template
├── index.html
├── package.json
├── README.md
└── vercel.json
```

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/Gaurangi25/ReelMind.git
cd ReelMind
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env.local` file using `.env.example` as a reference and add your Supabase configuration.

**4. Start the development server**

```bash
npm run dev
```

The application will run locally at `http://localhost:5173`.

## Chrome Extension

To install the extension locally:

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Open a YouTube or Instagram video and use the extension to save it.

## Live Application

**Website:** https://reelmind-henna.vercel.app/

## Author

**Gaurangi Agarwal**

GitHub: https://github.com/Gaurangi25

---

*Built to make saving and finding videos simpler.*
