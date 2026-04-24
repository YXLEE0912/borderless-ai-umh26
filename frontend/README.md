# Frontend

This folder contains the Vite + React frontend for the Borderless AI app.

## Prerequisites

- Node.js 18 or newer
- npm

## Install

From the `frontend` directory, install dependencies:

```bash
npm install
```

If you want the UI to call the local backend, set `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` in your frontend environment.

## Run locally

Start the development server:

```bash
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173/`.

## Common commands

Build the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run lint checks:

```bash
npm run lint
```

Run the test suite:

```bash
npm run test
```
