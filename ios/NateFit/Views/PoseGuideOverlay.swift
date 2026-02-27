import SwiftUI

struct PoseGuideOverlay: View {
    let phase: ScanPhase

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // Semi-transparent dark overlay outside the silhouette zone
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                // Guide silhouette
                if phase == .front {
                    FrontPoseSilhouette()
                        .stroke(Color.neonGreen.opacity(0.5), lineWidth: 2)
                        .frame(width: geo.size.width * 0.45, height: geo.size.height * 0.65)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.42)
                } else if phase == .side {
                    SidePoseSilhouette()
                        .stroke(Color.neonGreen.opacity(0.5), lineWidth: 2)
                        .frame(width: geo.size.width * 0.3, height: geo.size.height * 0.65)
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.42)
                }

                // Center crosshair
                CrosshairShape()
                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
                    .frame(width: 40, height: 40)
                    .position(x: geo.size.width / 2, y: geo.size.height * 0.42)

                // Foot markers
                HStack(spacing: geo.size.width * 0.15) {
                    FootMarker()
                    FootMarker()
                }
                .position(x: geo.size.width / 2, y: geo.size.height * 0.74)
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Front pose silhouette path

struct FrontPoseSilhouette: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Simplified human front silhouette
        // Head
        let headCenterX = w * 0.5
        let headTopY = h * 0.0
        let headRadius = w * 0.08
        path.addEllipse(in: CGRect(
            x: headCenterX - headRadius,
            y: headTopY,
            width: headRadius * 2,
            height: headRadius * 2.4
        ))

        // Neck
        let neckTop = headTopY + headRadius * 2.4
        path.move(to: CGPoint(x: w * 0.46, y: neckTop))
        path.addLine(to: CGPoint(x: w * 0.46, y: neckTop + h * 0.03))

        path.move(to: CGPoint(x: w * 0.54, y: neckTop))
        path.addLine(to: CGPoint(x: w * 0.54, y: neckTop + h * 0.03))

        // Torso + arms outline
        let shoulderY = neckTop + h * 0.03
        // Left arm out
        path.move(to: CGPoint(x: w * 0.46, y: shoulderY))
        path.addLine(to: CGPoint(x: w * 0.15, y: shoulderY + h * 0.02))
        path.addLine(to: CGPoint(x: w * 0.1, y: shoulderY + h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.15, y: shoulderY + h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.2, y: shoulderY + h * 0.05))
        path.addLine(to: CGPoint(x: w * 0.35, y: shoulderY + h * 0.04))

        // Left torso down
        path.addLine(to: CGPoint(x: w * 0.35, y: shoulderY + h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.37, y: shoulderY + h * 0.35))

        // Left leg
        path.addLine(to: CGPoint(x: w * 0.32, y: shoulderY + h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.37, y: shoulderY + h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.45, y: shoulderY + h * 0.35))

        // Right side (mirror)
        path.addLine(to: CGPoint(x: w * 0.55, y: shoulderY + h * 0.35))
        path.addLine(to: CGPoint(x: w * 0.63, y: shoulderY + h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.68, y: shoulderY + h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.63, y: shoulderY + h * 0.35))

        // Right torso up
        path.addLine(to: CGPoint(x: w * 0.65, y: shoulderY + h * 0.32))
        path.addLine(to: CGPoint(x: w * 0.65, y: shoulderY + h * 0.04))
        path.addLine(to: CGPoint(x: w * 0.8, y: shoulderY + h * 0.05))
        path.addLine(to: CGPoint(x: w * 0.85, y: shoulderY + h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.9, y: shoulderY + h * 0.28))
        path.addLine(to: CGPoint(x: w * 0.85, y: shoulderY + h * 0.02))
        path.addLine(to: CGPoint(x: w * 0.54, y: shoulderY))

        return path
    }
}

// MARK: - Side pose silhouette path

struct SidePoseSilhouette: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height

        // Head
        let headCenterX = w * 0.5
        let headTopY = h * 0.0
        let headRadius = w * 0.12
        path.addEllipse(in: CGRect(
            x: headCenterX - headRadius,
            y: headTopY,
            width: headRadius * 2,
            height: headRadius * 2.4
        ))

        // Simplified side profile body
        let neckTop = headTopY + headRadius * 2.4
        // Front edge
        path.move(to: CGPoint(x: w * 0.55, y: neckTop))
        path.addLine(to: CGPoint(x: w * 0.6, y: neckTop + h * 0.05))
        path.addLine(to: CGPoint(x: w * 0.65, y: neckTop + h * 0.15))
        path.addLine(to: CGPoint(x: w * 0.62, y: neckTop + h * 0.3))
        path.addLine(to: CGPoint(x: w * 0.58, y: neckTop + h * 0.35))
        path.addLine(to: CGPoint(x: w * 0.56, y: neckTop + h * 0.65))
        path.addLine(to: CGPoint(x: w * 0.52, y: neckTop + h * 0.65))
        // Back edge
        path.addLine(to: CGPoint(x: w * 0.45, y: neckTop + h * 0.35))
        path.addLine(to: CGPoint(x: w * 0.35, y: neckTop + h * 0.3))
        path.addLine(to: CGPoint(x: w * 0.32, y: neckTop + h * 0.15))
        path.addLine(to: CGPoint(x: w * 0.38, y: neckTop + h * 0.05))
        path.addLine(to: CGPoint(x: w * 0.45, y: neckTop))

        return path
    }
}

// MARK: - Helper shapes

struct CrosshairShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let mid = CGPoint(x: rect.midX, y: rect.midY)
        let len = rect.width * 0.4

        // Horizontal
        path.move(to: CGPoint(x: mid.x - len, y: mid.y))
        path.addLine(to: CGPoint(x: mid.x + len, y: mid.y))
        // Vertical
        path.move(to: CGPoint(x: mid.x, y: mid.y - len))
        path.addLine(to: CGPoint(x: mid.x, y: mid.y + len))

        return path
    }
}

struct FootMarker: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .stroke(Color.neonGreen.opacity(0.4), lineWidth: 1.5)
            .frame(width: 30, height: 14)
    }
}
