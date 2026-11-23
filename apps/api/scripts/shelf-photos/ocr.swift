import Foundation
import Vision
import AppKit
// Prints JSON lines of recognised text with boxes in top-left pixel coordinates of the original image, at 4 rotations
let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let W = Double(cg.width), H = Double(cg.height)
let orientations: [(CGImagePropertyOrientation, Int)] = [(.up, 0), (.right, 90), (.down, 180), (.left, 270)]
for (orientation, deg) in orientations {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([request])
  for obs in request.results ?? [] {
    guard let top = obs.topCandidates(1).first else { continue }
    let b = obs.boundingBox
    // Vision's box is normalised in the rotated view, origin bottom-left; map back to the upright source image
    var x = 0.0, y = 0.0, w = 0.0, h = 0.0
    switch deg {
    case 0: x = b.minX * W; y = (1 - b.maxY) * H; w = b.width * W; h = b.height * H
    case 180: x = (1 - b.maxX) * W; y = b.minY * H; w = b.width * W; h = b.height * H
    case 90: x = (1 - b.maxY) * W; y = (1 - b.maxX) * H; w = b.height * W; h = b.width * H
    default: x = b.minY * W; y = b.minX * H; w = b.height * W; h = b.width * H
    }
    let row: [String: Any] = ["deg": deg, "text": top.string, "conf": top.confidence, "x": x, "y": y, "w": w, "h": h]
    print(String(data: try JSONSerialization.data(withJSONObject: row), encoding: .utf8)!)
  }
}
