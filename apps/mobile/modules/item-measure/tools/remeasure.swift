import Foundation

// Re-measures every item of an exported batch with the current code, beside what the phone read.
// Usage: remeasure <batch folder>   Prints one JSON line per item.

struct Remeasured: Codable {
    let itemId: String
    let phone: ItemReading?
    let mac: ItemReading?
    let error: String?
}

@main
struct Remeasure {
    static func main() throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let items = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).sorted { $0.path < $1.path }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        for item in items where FileManager.default.fileExists(atPath: item.appendingPathComponent("capture.json").path) {
            let (capture, frames, depths) = try readCapture(from: item)
            let row: Remeasured
            do {
                let mac = try readItem(frames: frames, depths: depths, flat: capture.mode == "flat", planeY: capture.planeY)
                row = Remeasured(itemId: item.lastPathComponent, phone: capture.reading, mac: mac, error: nil)
            } catch {
                row = Remeasured(itemId: item.lastPathComponent, phone: capture.reading, mac: nil, error: error.localizedDescription)
            }
            print(String(decoding: try encoder.encode(row), as: UTF8.self))
        }
    }
}
