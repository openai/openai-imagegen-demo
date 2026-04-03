# Photobooth ImageGen Demo

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Built_with-Next.js-blue)
![OpenAI](https://img.shields.io/badge/Powered_by-OpenAI_Image_API-black)

A modern full-screen photobooth demo built with Next.js, Tailwind CSS, and OpenAI image editing.

## What it does

- Capture a photo from webcam or upload an image.
- Multi-select styles (Knitted, Anime, Digital Art, Film Noir, Watercolor).
- Stream partial style renders in real time.
- View results in a responsive grid.
- Open any result in a fullscreen modal and download it.

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn-style UI components
- OpenAI Images API (`/images/edits`) with streaming events

## Requirements

- Node.js 20+
- OpenAI API key

## Setup

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY="your-openai-api-key"
```

Optional:

```bash
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_ORG_ID=""
OPENAI_PROJECT_ID=""
```

Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `app/page.tsx`: fullscreen photobooth capture/upload and style selection
- `app/results/page.tsx`: streaming style cards, modal preview, downloads
- `app/api/photobooth/route.ts`: server-side streaming image edit orchestration
- `lib/photobooth-styles.ts`: style catalog and prompts
- `services/imagegenApi.ts`: client-side SSE stream parser and API helper

## License

MIT. See [LICENSE](./LICENSE).
