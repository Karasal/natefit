# NATEFIT — AI Body Scanner

## What This Is
Browser-based body composition scanner using phone camera + AI.
Replaces $6,500 Styku hardware with a webapp.

## Stack
- **Framework**: Next.js 16 + TypeScript + Tailwind v4
- **Backend**: Supabase (Auth, DB, Storage)
- **ML**: MediaPipe BlazePose (33 keypoints) + TF.js body segmentation
- **3D**: React Three Fiber
- **Charts**: Recharts
- **Deploy**: Vercel

## Architecture
- `lib/scan/` — Core algorithms (THE product). Circumference calculator, body composition, silhouette analyzer.
- `components/scan/` — Camera capture, pose guide, scan flow state machine.
- `components/measurements/` — Data visualization (tables, gauges, charts, body map).
- `app/dashboard/` — Trainer-facing routes.
- `app/portal/` — Client-facing routes.

## Critical Files (accuracy depends on these)
1. `lib/scan/circumference-calculator.ts` — Ellipse model + correction factors
2. `lib/scan/silhouette-analyzer.ts` — Pixel width extraction from segmentation mask
3. `lib/scan/body-composition.ts` — Navy + CUN-BAE body fat formulas
4. `lib/scan/calibrator.ts` — Height-based pixel scale calibration
5. `components/scan/CameraCapture.tsx` — Must work on every phone browser

## Design System
Dark athletic aesthetic. Color tokens in `globals.css`.
- Neon green (#00FF87) = primary accent
- Glass cards: `backdrop-blur-xl bg-white/5 border border-white/10`
- Fonts: Space Grotesk (display), Inter (body), JetBrains Mono (data)

## Body Fat Formula (Ensemble)
- 60% Navy Formula (uses waist, neck, hip circumferences)
- 40% CUN-BAE Formula (uses BMI, age, sex)
- Correction factors per region in `lib/scan/constants.ts`

## Database
Schema: `supabase/migrations/001_initial_schema.sql`
Tables: profiles, organizations, org_members, clients, scans, measurements, goals, scan_comparisons

## Commands
```bash
npm run dev     # Dev server at :3000
npm run build   # Production build
```
