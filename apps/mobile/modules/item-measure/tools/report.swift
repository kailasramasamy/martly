import Foundation

// Re-measures saved captures with the current code and compares to the ruler values.
// Usage: report <captures folder>

struct Row {
    let name: String
    let material: String
    let errors: [Float]
}

func errors(_ m: Measurement?, _ t: Truth) -> [Float] {
    guard let m else { return [] }
    var out = [Float]()
    if let long = t.longMm { out.append(abs(m.longMm - long)) }
    if let short = t.shortMm { out.append(abs(m.shortMm - short)) }
    if let height = t.heightMm, let measured = m.heightMm { out.append(abs(measured - height)) }
    return out
}

func summary(_ title: String, _ rows: [Row]) {
    let all = rows.flatMap(\.errors).sorted()
    guard !all.isEmpty else { return }
    let within10 = Float(all.filter { $0 <= 10 }.count) / Float(all.count) * 100
    print(String(format: "%@: %d readings, median %.1f mm, 90th percentile %.1f mm, %.0f%% within 10 mm", title, all.count,
                 percentile(all, 0.5), percentile(all, 0.9), within10))
}

func describe(_ m: Measurement?) -> String {
    guard let m else { return "none" }
    return String(format: "%@ %.0f×%.0f h%.0f fit %.2f", m.shape, m.longMm, m.shortMm, m.heightMm ?? 0, m.iou ?? 0)
}

@main
struct Report {
    static func main() throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let folders = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).sorted { $0.path < $1.path }
        var outlineRows = [Row]()
        var lidarRows = [Row]()
        for folder in folders where FileManager.default.fileExists(atPath: folder.appendingPathComponent("capture.json").path) {
            let (capture, frames, depths) = try readCapture(from: folder)
            guard let truth = capture.truth else { continue }
            let tableY = tableHeight(frames: frames, depths: depths) ?? capture.tableY
            let upright = capture.mode == "flat" ? (frames: frames, depths: depths, slideMm: Float(0)) : alignOverheadView(frames, depths, tableY: tableY)
            let outline = capture.mode == "flat" ? estimateFlat(frames, tableY: tableY) : estimateUpright(upright.frames, tableY: tableY)
            let lidar = capture.mode == "flat" ? nil : estimateFromDepth(frames: upright.frames, depths: upright.depths, tableY: tableY)
            let truthText = String(format: "%.0f×%.0f h%.0f", truth.longMm ?? 0, truth.shortMm ?? 0, truth.heightMm ?? 0)
            print("\(truth.name) [\(truth.material), pitch \(Int(capture.pitchDegrees))] true \(truthText) | outline \(describe(outline)) | lidar \(describe(lidar)) | top view slid \(Int(upright.slideMm)) mm")
            outlineRows.append(Row(name: truth.name, material: truth.material, errors: errors(outline, truth)))
            lidarRows.append(Row(name: truth.name, material: truth.material, errors: errors(lidar, truth)))
        }
        for (title, rows) in [("Outline", outlineRows), ("LiDAR", lidarRows)] {
            summary(title, rows)
            for material in Set(rows.map(\.material)).sorted() { summary("  \(material)", rows.filter { $0.material == material }) }
        }
    }
}
