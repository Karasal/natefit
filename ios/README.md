# NATEFIT iOS - LiDAR Body Scanner

iOS companion app for NATEFIT that captures RGB photos + LiDAR depth data and sends them to the GPU backend for body composition analysis.

## Requirements

- **Xcode 15+** (Swift 5.9+)
- **iOS 17.0+** deployment target
- **iPhone 12 Pro or later** (LiDAR sensor required for depth capture; falls back gracefully on non-LiDAR devices)
- **Apple Developer account** (required for ARKit on-device testing)

## Project Setup

### 1. Create Xcode Project

1. Open Xcode > File > New > Project
2. Choose **iOS > App**
3. Settings:
   - Product Name: **NateFit**
   - Team: Your Apple Developer team
   - Organization Identifier: `com.natefit`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: None
   - Uncheck "Include Tests" (add later)
4. Save to the `ios/` directory

### 2. Add Source Files

Replace the generated `ContentView.swift` and `NateFitApp.swift` with the files from `NateFit/`. Copy the full directory structure:

```
NateFit/
├── NateFitApp.swift
├── ContentView.swift
├── Info.plist
├── Views/
│   ├── LoginView.swift
│   ├── ClientSelectView.swift
│   ├── ScanCaptureView.swift
│   ├── PoseGuideOverlay.swift
│   └── ResultsView.swift
├── Services/
│   ├── ARCaptureService.swift
│   ├── APIClient.swift
│   └── AuthService.swift
└── Models/
    ├── ScanData.swift
    └── ScanResult.swift
```

### 3. Add Dependencies (SPM)

File > Add Package Dependencies, then add:

| Package | URL | Version |
|---------|-----|---------|
| supabase-swift | `https://github.com/supabase-community/supabase-swift` | >= 2.0.0 |

### 4. Configure Info.plist

Update these values in `Info.plist` with your actual credentials:

```xml
<key>SUPABASE_URL</key>
<string>https://your-actual-project.supabase.co</string>

<key>SUPABASE_ANON_KEY</key>
<string>your-actual-anon-key</string>

<key>SCAN_API_URL</key>
<string>https://your-gpu-backend-url.com</string>
```

### 5. Xcode Project Settings

In your target's Build Settings / Signing & Capabilities:

- **Signing**: Select your team and provisioning profile
- **Deployment Target**: iOS 17.0
- **Device Orientation**: Portrait only
- **Frameworks**: ARKit is imported directly in Swift files (no manual linking needed)

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   SwiftUI    │────▶│   ARCaptureService│────▶│   APIClient      │
│   Views      │     │   (ARKit + LiDAR) │     │   (Upload to GPU)│
└──────────────┘     └──────────────────┘     └──────────────────┘
       │                                              │
       ▼                                              ▼
┌──────────────┐                              ┌──────────────────┐
│  AuthService │                              │  GPU Backend     │
│  (Supabase)  │                              │  (SMPL fitting)  │
└──────────────┘                              └──────────────────┘
```

### Scan Flow

1. Trainer signs in via Supabase auth
2. Selects a client from their organization
3. Enters client metadata (height, weight, age, sex)
4. **Front capture**: Client faces camera, arms slightly out. App captures RGB + LiDAR depth.
5. **Side capture**: Client turns 90 degrees. Second capture.
6. App uploads both frames (RGB JPEG + depth float32 binary + camera intrinsics) to GPU backend
7. Backend returns measurements, body composition, and optional 3D mesh
8. Results displayed in-app with option to view full dashboard on web

### LiDAR Data Format

- **Depth map**: 256x192 float32 values (distance in meters), ~196KB per frame
- **Confidence map**: 256x192 uint8 values (0=low, 1=medium, 2=high), ~49KB per frame
- **Camera intrinsics**: fx, fy, cx, cy from ARFrame.camera.intrinsics 3x3 matrix
- **RGB**: Full-resolution JPEG at 0.92 quality

## Build & Run

1. Connect an iPhone 12 Pro (or later) via USB
2. Select the device in Xcode's scheme selector
3. Build and run (Cmd+R)

**Note**: ARKit requires a physical device. The simulator does not support LiDAR or camera.

## TestFlight Deployment

1. In Xcode: Product > Archive
2. In Organizer: Distribute App > TestFlight & App Store
3. Upload to App Store Connect
4. In App Store Connect: add testers to TestFlight group
5. Testers install via TestFlight app on their devices

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Tracking not available" | Ensure good lighting and textured environment |
| No depth data captured | Verify device has LiDAR (iPhone 12 Pro+). Check `ARCaptureService.hasLiDAR` |
| Upload fails | Check `SCAN_API_URL` in Info.plist. Verify GPU backend is running. Check network connectivity. |
| Auth fails | Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Info.plist |
| Build errors with supabase-swift | Ensure SPM resolved correctly: File > Packages > Reset Package Caches |
