import AppKit
import Combine
import Foundation
import QuartzCore

final class StageController: ObservableObject {
  @Published private(set) var courtImage: NSImage?
  @Published private(set) var frameSerial: UInt64 = 0
  @Published private(set) var isRecording = false
  @Published private(set) var status = "native stage"

  let sampleRate: Double
  private let lock = NSLock()
  private var engine: OpaquePointer?
  private let audio: StageAudio
  private let recorder = StageRecorder()
  private var displayLink: CVDisplayLink?
  private var observers: [NSObjectProtocol] = []
  private let courtBytes = UnsafeMutablePointer<UInt8>.allocate(capacity: 240 * 240 * 4)
  private let scaledBytes = UnsafeMutablePointer<UInt8>.allocate(capacity: 240 * 3 * 240 * 3 * 4)
  private let scaleFactor = 3
  private var recording = false
  private var lastStatusBeat: Float = -1
  private var lastSnapWall = 0.0
  private var lastSnapBeat: Float = 0
  private var lastSnapBpm: Float = 100
  private var lastSnap = HtStageCourtSnapshot()
  private var hasSnap = false

  init(sampleRate: Double = 96_000) {
    self.sampleRate = sampleRate
    self.audio = StageAudio(sampleRate: sampleRate)
    self.engine = ht_stage_create(sampleRate)
    audio.onRender = { [weak self] buffer, frames in
      self?.fillAudio(buffer: buffer, frames: frames)
    }
    audio.start()
    startDisplay()
    observeCommands()
    lock.lock()
    let line = makeStatusLocked(prefix: nil)
    lock.unlock()
    if let error = audio.lastError, !audio.isRunning {
      status = "audio failed · \(error)"
    } else {
      status = line
    }
  }

  deinit {
    stopDisplay()
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    audio.stop()
    lock.lock()
    if let engine {
      ht_stage_destroy(engine)
    }
    self.engine = nil
    lock.unlock()
    courtBytes.deallocate()
    scaledBytes.deallocate()
  }

  func chaos() {
    lock.lock()
    ht_stage_chaos(engine)
    let line = makeStatusLocked(prefix: "chaos")
    lock.unlock()
    status = line
  }

  func newPatch() {
    lock.lock()
    ht_stage_new_patch(engine)
    let line = makeStatusLocked(prefix: "patch")
    lock.unlock()
    status = line
  }

  func toggleRecord() {
    if isRecording {
      lock.lock()
      recording = false
      ht_stage_set_master(engine, 0.85)
      lock.unlock()
      isRecording = false
      if let url = recorder.stop() {
        status = "saved \(url.lastPathComponent)"
        NSWorkspace.shared.activateFileViewerSelecting([url])
      }
      return
    }
    do {
      lock.lock()
      let rate = ht_stage_sample_rate(engine)
      lock.unlock()
      try recorder.start(sampleRate: rate)
      lock.lock()
      recording = true
      lock.unlock()
      isRecording = true
      status = "recording 4K · \(Int(rate)) Hz 32-bit float"
    } catch {
      status = "record failed"
    }
  }

  private func fillAudio(buffer: UnsafeMutablePointer<Float>, frames: Int) {
    lock.lock()
    /* ht_stage_render advances the generative clock from sample counts. */
    ht_stage_render(engine, buffer, UInt32(frames))
    let rate = ht_stage_sample_rate(engine)
    let shouldRecord = recording
    lock.unlock()
    if shouldRecord {
      let count = frames * 2
      var samples = [Float](repeating: 0, count: count)
      for index in 0 ..< count {
        samples[index] = buffer[index]
      }
      recorder.appendAudio(interleaved: samples, sampleRate: rate, channels: 2)
    }
  }

  private func startDisplay() {
    var link: CVDisplayLink?
    CVDisplayLinkCreateWithActiveCGDisplays(&link)
    guard let link else {
      return
    }
    displayLink = link
    let callback: CVDisplayLinkOutputCallback = { _, _, _, _, _, context -> CVReturn in
      guard let context else {
        return kCVReturnSuccess
      }
      let controller = Unmanaged<StageController>.fromOpaque(context).takeUnretainedValue()
      controller.refreshCourt()
      return kCVReturnSuccess
    }
    CVDisplayLinkSetOutputCallback(link, callback, UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()))
    CVDisplayLinkStart(link)
  }

  private func stopDisplay() {
    if let displayLink {
      CVDisplayLinkStop(displayLink)
    }
    displayLink = nil
  }

  private func refreshCourt() {
    var statusLine: String?
    let shouldRecord: Bool
    let now = CACurrentMediaTime()

    /* Prefer a fresh snapshot without blocking the audio callback. */
    if lock.try() {
      if !audio.isRunning {
        ht_stage_tick_ms(engine, now * 1000.0)
      }
      ht_stage_snapshot_court(engine, &lastSnap)
      lastSnapWall = now
      lastSnapBeat = lastSnap.frame.time_beat
      lastSnapBpm = lastSnap.bpm > 1 ? lastSnap.bpm : 100
      hasSnap = true
      if abs(lastSnap.pattern_beat - lastStatusBeat) >= 1.0 {
        lastStatusBeat = lastSnap.pattern_beat
        statusLine = makeStatusLocked(prefix: nil)
      }
      shouldRecord = recording
      lock.unlock()
    } else if hasSnap {
      shouldRecord = recording
    } else {
      return
    }

    /* Extrapolate beat while audio holds the lock so arcs stay continuous. */
    let extra = Float(max(0, now - lastSnapWall) * Double(lastSnapBpm) / 60.0)
    let drawBeat = lastSnapBeat + extra
    var snap = lastSnap
    ht_stage_draw_court_rgba(&snap, drawBeat, courtBytes)

    if let statusLine {
      DispatchQueue.main.async {
        self.status = statusLine
      }
    }

    let width = 240
    let height = 240
    let scale = scaleFactor
    let outWidth = width * scale
    let outHeight = height * scale
    for y in 0 ..< height {
      for x in 0 ..< width {
        let src = (y * width + x) * 4
        let r = courtBytes[src]
        let g = courtBytes[src + 1]
        let b = courtBytes[src + 2]
        let a = courtBytes[src + 3]
        for dy in 0 ..< scale {
          for dx in 0 ..< scale {
            let dst = ((y * scale + dy) * outWidth + (x * scale + dx)) * 4
            scaledBytes[dst] = r
            scaledBytes[dst + 1] = g
            scaledBytes[dst + 2] = b
            scaledBytes[dst + 3] = a
          }
        }
      }
    }

    let data = Data(bytes: scaledBytes, count: outWidth * outHeight * 4)
    guard let provider = CGDataProvider(data: data as CFData),
          let cgImage = CGImage(
            width: outWidth,
            height: outHeight,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: outWidth * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
          )
    else {
      return
    }
    let image = NSImage(cgImage: cgImage, size: NSSize(width: outWidth, height: outHeight))
    DispatchQueue.main.async {
      self.courtImage = image
      self.frameSerial &+= 1
    }
    if shouldRecord, let tiff = image.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiff),
       let png = rep.representation(using: .png, properties: [:])
    {
      recorder.appendFrame(pngDataURL: "data:image/png;base64,\(png.base64EncodedString())")
    }
  }

  private func makeStatusLocked(prefix: String?) -> String {
    let rate = ht_stage_sample_rate(engine)
    let seed = ht_stage_seed(engine)
    let bpm = ht_stage_bpm(engine)
    let beat = ht_stage_pattern_beat(engine)
    let siteswap = String(cString: ht_stage_siteswap(engine))
    let head = prefix.map { "\($0) · " } ?? ""
    return String(format: "%@%@ · beat %.1f · %.0f bpm · %.0f Hz · %08x", head, siteswap, beat, bpm, rate, seed)
  }

  private func observeCommands() {
    observers.append(
      NotificationCenter.default.addObserver(forName: .stageChaos, object: nil, queue: .main) { [weak self] _ in
        self?.chaos()
      }
    )
    observers.append(
      NotificationCenter.default.addObserver(forName: .stageNewPatch, object: nil, queue: .main) { [weak self] _ in
        self?.newPatch()
      }
    )
    observers.append(
      NotificationCenter.default.addObserver(forName: .stageToggleRecord, object: nil, queue: .main) { [weak self] _ in
        self?.toggleRecord()
      }
    )
  }
}
