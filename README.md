# Mega Hub (prototype)
Church volunteer rotas app — Expo + expo-router + TypeScript. Departments: Music, Kids, Obreiros.

- `npm install` then `npx expo start` (scan QR with free Expo Go) or `npm run web`
- `npm run typecheck` · `npm run export:web` (static build in `dist/`)
- Mock data: `src/data/mockData.ts`. Data boundary: `src/data/repository.ts` (swap for Supabase later).
- Role switcher on the Home tab (demo only; real sign-in comes later).
