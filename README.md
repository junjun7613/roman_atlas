# Roman Atlas - Interactive 3D Map

An interactive 3D visualization of Roman provinces, roads, and archaeological sites using Next.js 16 and Cesium.

## Features

- **3D Globe Visualization** powered by Cesium
- **Roman Provinces** boundary data
- **Ancient Routes** including main roads, secondary roads, sea lanes, and rivers
- **Pleiades Places** archaeological sites (settlements, forts, temples, etc.)
- **Interactive Control Panel** for toggling layers
- Built with **Next.js 16**, **React 19**, and **Tailwind CSS v4**

## Prerequisites

- Node.js >= 20.11.1
- npm or yarn

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/junjun7613/roman_atlas.git
cd roman_atlas
```

### 2. Install dependencies

```bash
npm install
```

**Note:** The `postinstall` script will automatically copy Cesium static assets from `node_modules` to `public/cesium/`.

### 3. Download data files

Due to GitHub file size limitations, you need to download the following data files separately and place them in the `public/` directory:

- `provinces.geojson` - Roman provinces boundary data
- `route-segments-all.ndjson` - Roman roads and routes data
- `pleiades-places-filtered-expanded.json` - Archaeological sites data

**Note:** Contact the repository owner for access to these data files.

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and add your Cesium Ion access token:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your token:

```
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_cesium_ion_token_here
```

Get your free token from: https://cesium.com/ion/tokens

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build for production

```bash
npm run build
npm start
```

## Deploy to Vercel

### Option 1: Deploy with data files hosted externally

1. **Upload data files** to a public hosting service (GitHub raw URLs, CDN, etc.)
   - `provinces.geojson`
   - `route-segments-all.ndjson`
   - `pleiades-places-filtered-expanded.json`

2. **Deploy to Vercel**:
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Set environment variables** in Vercel dashboard:
   - `NEXT_PUBLIC_CESIUM_ION_TOKEN` - Your Cesium Ion token
   - `NEXT_PUBLIC_PROVINCES_URL` - URL to provinces.geojson (e.g., Dropbox direct link with `dl=1`)
   - `NEXT_PUBLIC_ROUTES_URL` - URL to route-segments-all.ndjson
   - `NEXT_PUBLIC_PLACES_URL` - URL to pleiades-places-filtered-expanded.json

**Note:** The app uses Next.js API Routes as a proxy to avoid CORS issues when loading external data files.

### Option 2: One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/junjun7613/roman_atlas)

**Note:** You'll need to set the environment variables after deployment.

## Project Structure

```
roman_atlas/
├── app/
│   ├── components/
│   │   ├── CesiumMap.tsx      # Main 3D map component
│   │   └── ControlPanel.tsx   # Layer control panel
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
│   ├── cesium/                # Cesium static assets
│   ├── provinces.geojson      # (Download separately)
│   ├── route-segments-all.ndjson  # (Download separately)
│   └── pleiades-places-filtered-expanded.json  # (Download separately)
├── next.config.ts
└── package.json
```

## Technologies

- **Next.js 16** - React framework with Turbopack
- **React 19** - UI library
- **Cesium 1.135** - 3D globe and maps
- **Tailwind CSS v4** - Styling
- **TypeScript** - Type safety

## Data Sources

- **Roman Provinces**: Historical boundary data
- **Roman Roads**: [Itiner-e](https://itiner-e.org/) project data
- **Archaeological Sites**: [Pleiades](https://pleiades.stoa.org/) gazetteer

## License

MIT

## Credits

Developed with assistance from [Claude Code](https://claude.com/claude-code)
