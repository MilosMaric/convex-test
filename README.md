# Task Management App

A full-stack task management application with web and mobile clients, built with React, React Native, and Convex.

## Features

### Core Functionality
- ✅ Create and manage tasks with titles and descriptions
- ✅ Mark tasks as complete/incomplete
- ✅ Mark tasks as important
- ✅ Track task history (completion and importance changes)
- ✅ Task duration estimation
- ✅ Created and updated timestamps

### Web App Features
- **Multiple View Modes**: Compact grid, Extended grid, and List view
- **Advanced Filtering**:
  - Status filters (Completed/Incomplete - non-exclusive)
  - Duration filters (Quick ≤15min / Long >15min)
  - Importance filter
  - Server-side search by title/description (400ms debounce)
- **Sorting Options**:
  - Latest Updated / Inactive
  - Newest / Oldest (by creation date)
  - Frequent / Unfrequent (by history count)
  - Quickest / Longest (by duration)
- **Infinite Scroll**: Automatic pagination (50 items per page)
- **Task Details Drawer**: View full task details, history, and toggle status/importance
- **Visual Indicators**:
  - Green border (1.5px) for completed tasks
  - Amber border (1.5px) for important tasks
  - Important border takes precedence when both apply

### Mobile App Features
- **Tab Navigation**: All, Important, Complete, Incomplete
- **Duration Filter Toggle**: Cycle between All, Quick, Long
- **Sorting**: Same options as web, with per-tab persistence
- **Infinite Scroll**: Automatic pagination (9 items per page)
- **Full-Screen Task Details**: Tap to view task details with history
- **Swipe Actions**: Swipe left to reveal quick action buttons
- **Visual Indicators**: Same border styling as web app

## Tech Stack

### Frontend (Web)
- **React** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling
- **Shadcn UI** components
- **Convex** for real-time data

### Frontend (Mobile)
- **React Native** + **Expo**
- **Expo Router** for navigation
- **Convex** for real-time data

### Backend
- **Convex** (serverless backend)
  - Real-time queries and mutations
  - Automatic reactivity
  - Built-in pagination support

## Project Structure

```
.
├── convex/              # Convex backend
│   ├── schema.ts        # Database schema
│   └── tasks.ts         # Queries and mutations
├── src/                 # Web app source
│   ├── App.tsx          # Main web component
│   └── components/      # UI components
├── mobile/              # Mobile app
│   ├── app/             # Expo Router screens
│   └── components/      # React Native components
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Convex account (free tier available)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd convex-test
   ```

2. **Install dependencies**
   ```bash
   # Install web app dependencies
   npm install
   
   # Install mobile app dependencies
   cd mobile
   npm install
   cd ..
   ```

3. **Set up Convex**
   ```bash
   npx convex dev
   ```
   This will guide you through Convex setup and start the development server.

4. **Run the web app**
   ```bash
   npm run dev
   ```
   The web app will be available at `http://localhost:5555`

5. **Run the mobile app**
   ```bash
   cd mobile
   npm start
   ```
   Then scan the QR code with Expo Go app on your device.

## Development

### Convex Backend
- Run `npx convex dev` to start the Convex development server
- Schema changes are automatically synced
- Queries and mutations are hot-reloaded

### Web App
- Development server runs on `http://localhost:5173`
- Hot module replacement enabled
- TypeScript for type safety

### Mobile App
- Uses Expo development build
- Hot reloading enabled
- Metro bundler for JavaScript bundling

## Key Features Implementation

### Server-Side Search
- Search queries are debounced (400ms) on the client
- Filtering happens server-side in Convex
- Searches both task titles and descriptions

### Task History
- All status and importance changes are tracked
- History entries include timestamps and change types
- Filterable by change type in task detail views

### State Persistence
- Web app: Filters, sort, and view mode persisted in URL query params
- Mobile app: Sort preference persisted per tab

## License

MIT
