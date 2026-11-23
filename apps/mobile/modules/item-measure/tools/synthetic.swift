import Foundation
import simd

// Renders known items from known camera positions and checks the estimators recover their size.

func lookAt(eye: V3, target: V3, rollDegrees: Float) -> simd_float4x4 {
    let back = simd_normalize(eye - target)
    let right = simd_normalize(simd_cross(V3(0, 1, 0), back))
    let up = simd_cross(back, right)
    let view = simd_float4x4(SIMD4(right, 0), SIMD4(up, 0), SIMD4(back, 0), SIMD4(eye, 1))
    let r = rollDegrees * .pi / 180
    let roll = simd_float4x4(SIMD4(cos(r), sin(r), 0, 0), SIMD4(-sin(r), cos(r), 0, 0), SIMD4(0, 0, 1, 0), SIMD4(0, 0, 0, 1))
    return view * roll
}

func render(_ points: [V3], cameraToWorld: simd_float4x4, grow: Int) -> ViewFrame {
    let (w, h) = (480, 360)
    let empty = Mask(width: w, height: h, pixels: [UInt8](repeating: 0, count: w * h))
    let blank = ViewFrame(mask: empty, fx: 362, fy: 362, cx: 240, cy: 180, cameraToWorld: cameraToWorld)
    let hull = convexHull(points.compactMap { blank.project($0) })
    var pixels = [UInt8](repeating: 0, count: w * h)
    for y in 0..<h {
        for x in 0..<w {
            let p = V2(Float(x), Float(y))
            var inside = true
            for i in hull.indices {
                let a = hull[i], b = hull[(i + 1) % hull.count]
                let len = simd_length(b - a)
                if (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < -Float(grow) * len { inside = false; break }
            }
            if inside { pixels[y * w + x] = 1 }
        }
    }
    return ViewFrame(mask: Mask(width: w, height: h, pixels: pixels), fx: 362, fy: 362, cx: 240, cy: 180, cameraToWorld: cameraToWorld)
}

/// Top, front and side views, as a person takes them. `drift` shifts the last view to mimic tracking error between snaps.
func views(_ points: [V3], distance: Float, pitch: Float, grow: Int, drift: Float = 0) -> [ViewFrame] {
    let shots: [(azimuth: Float, pitch: Float)] = [(0.7, 75), (0.7, pitch), (0.7 + .pi / 2, pitch)]
    return shots.enumerated().map { index, shot in
        let p = shot.pitch * .pi / 180
        let eye = V3(sin(shot.azimuth) * cos(p), sin(p), cos(shot.azimuth) * cos(p)) * distance
        let trueView = lookAt(eye: eye, target: V3(0, 0.03, 0), rollDegrees: 90)
        let frame = render(points, cameraToWorld: trueView, grow: grow)
        guard index == 2, drift > 0 else { return frame }
        var reported = trueView
        reported.columns.3 += SIMD4<Float>(drift, 0, -drift, 0)
        return ViewFrame(mask: frame.mask, fx: frame.fx, fy: frame.fy, cx: frame.cx, cy: frame.cy, cameraToWorld: reported)
    }
}

func cylinder(top: Float, base: Float, height: Float) -> [V3] {
    (0..<48).flatMap { i -> [V3] in
        let a = Float(i) / 48 * 2 * .pi
        return [V3(cos(a) * base / 2, 0, sin(a) * base / 2), V3(cos(a) * top / 2, height, sin(a) * top / 2)]
    }
}

func box(_ l: Float, _ w: Float, _ h: Float, yaw: Float) -> [V3] {
    [(Float(1), Float(1)), (1, -1), (-1, -1), (-1, 1)].flatMap { (a, b) -> [V3] in
        let x = a * l / 2, z = b * w / 2
        let xr = x * cos(yaw) - z * sin(yaw), zr = x * sin(yaw) + z * cos(yaw)
        return [V3(xr, 0, zr), V3(xr, h, zr)]
    }
}

/// A mask one pixel too wide at this distance adds about 3 mm to a width, so that case gets a wider limit.
var limitMm: Float = 2

func check(_ name: String, _ got: Measurement?, long: Float, short: Float, height: Float?) -> Bool {
    guard let m = got else { print("FAIL \(name): no result"); return false }
    let errors = [m.longMm - long, m.shortMm - short, (m.heightMm ?? 0) - (height ?? 0)].map(abs)
    let pass = errors.max()! < limitMm
    let text = String(format: "%@ %@ shape=%@ long %.1f/%.0f short %.1f/%.0f height %.1f/%.0f iou %.3f", pass ? "ok  " : "FAIL",
                      name, m.shape, m.longMm, long, m.shortMm, short, m.heightMm ?? 0, height ?? 0, m.iou ?? 0)
    print(text)
    return pass
}

/// A filled L: the concave case, where a convex hull would lose the notch
func outlineHoldsItsShape() -> Bool {
    let (w, h) = (200, 300)
    var pixels = [UInt8](repeating: 0, count: w * h)
    for y in 50..<250 { for x in 40..<160 where y >= 180 || x < 90 { pixels[y * w + x] = 255 } }
    let outline = uprightOutline(Mask(width: w, height: h, pixels: pixels))
    let (xs, ys) = (outline.map { $0[0] }, outline.map { $0[1] })
    // Twice the area of the loop, by the shoelace formula, against the L's share of its bounding box
    var doubled: Float = 0
    for i in outline.indices {
        let j = (i + 1) % outline.count
        doubled += xs[i] * ys[j] - xs[j] * ys[i]
    }
    let spanX = xs.max()! - xs.min()!, spanY = ys.max()! - ys.min()!
    let share = abs(doubled) / 2 / (spanX * spanY)
    let expected: Float = 14900.0 / 24000.0 // the L covers 14,900 of its 24,000 box pixels
    let pass = outline.count >= 6 && outline.count <= 120 && abs(share - expected) < 0.03
    print(String(format: "%@ outline of an L: %d points, area share %.3f/%.3f", pass ? "ok  " : "FAIL", outline.count, share, expected))
    return pass
}

/// A saved bundle must read back to the same size the phone measured, or the Mac would measure something else
func bundleRoundTrips() -> Bool {
    let frames = views(box(0.2, 0.13, 0.07, yaw: 0.4), distance: 0.5, pitch: 30, grow: 0)
    let depths = frames.map { _ in DepthMap(width: 4, height: 3, depth: [Float](repeating: 0, count: 12), confidence: [UInt8](repeating: 0, count: 12)) }
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent("synthetic-bundle-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: folder) }
    do {
        let phone = try readItem(frames: frames, depths: depths, flat: false, planeY: 0)
        let saved = SavedCapture(mode: "upright", pitchDegrees: 75, planeY: 0, tableY: phone.tableHeight, frames: [], reading: phone)
        try writeCapture(saved, frames: frames, depths: depths, to: folder)
        let (capture, readFrames, readDepths) = try readCapture(from: folder)
        let mac = try readItem(frames: readFrames, depths: readDepths, flat: capture.mode == "flat", planeY: capture.planeY)
        let same = [mac.lengthMm, mac.widthMm, mac.heightMm] == [phone.lengthMm, phone.widthMm, phone.heightMm] && capture.reading?.lengthMm == phone.lengthMm
        print("\(same ? "ok  " : "FAIL") bundle round trip: phone \(phone.lengthMm ?? 0)×\(phone.widthMm ?? 0)×\(phone.heightMm ?? 0), mac \(mac.lengthMm ?? 0)×\(mac.widthMm ?? 0)×\(mac.heightMm ?? 0)")
        return same
    } catch {
        print("FAIL bundle round trip: \(error)")
        return false
    }
}

@main
struct SyntheticTest {
    static func main() {
        var passed = true
        for grow in [0, 1] {
            limitMm = grow == 0 ? 2 : 5
            for pitch: Float in [20, 35] {
                let tag = "grow\(grow) pitch\(Int(pitch))"
                let tumbler = views(cylinder(top: 0.08, base: 0.065, height: 0.12), distance: 0.4, pitch: pitch, grow: grow)
                passed = check("tumbler \(tag)", estimateUpright(tumbler, tableY: 0), long: 80, short: 80, height: 120) && passed
                let dabba = views(cylinder(top: 0.14, base: 0.14, height: 0.09), distance: 0.45, pitch: pitch, grow: grow)
                passed = check("dabba \(tag)", estimateUpright(dabba, tableY: 0), long: 140, short: 140, height: 90) && passed
                let tub = views(box(0.2, 0.13, 0.07, yaw: 0.4), distance: 0.5, pitch: pitch, grow: grow)
                passed = check("tub \(tag)", estimateUpright(tub, tableY: 0), long: 200, short: 130, height: 70) && passed
                let spoon = views(box(0.18, 0.04, 0.0001, yaw: 1.1), distance: 0.4, pitch: pitch, grow: grow)
                passed = check("spoon \(tag)", estimateFlat(spoon, tableY: 0), long: 180, short: 40, height: nil) && passed
            }
        }
        limitMm = 10
        let drifted = views(box(0.2, 0.13, 0.07, yaw: 0.4), distance: 0.5, pitch: 25, grow: 0, drift: 0.005)
        passed = check("tub with 5 mm tracking drift", estimateUpright(drifted, tableY: 0), long: 200, short: 130, height: 70) && passed
        passed = outlineHoldsItsShape() && passed
        passed = bundleRoundTrips() && passed
        print(passed ? "ALL PASSED" : "SOME FAILED")
        exit(passed ? 0 : 1)
    }
}
