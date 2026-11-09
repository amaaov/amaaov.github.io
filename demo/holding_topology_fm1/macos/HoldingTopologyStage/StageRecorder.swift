import AppKit
import AVFoundation
import CoreImage
import Foundation

/// Writes Instagram-style 4K vertical video (2160x3840) with 96 kHz 32-bit float PCM when available.
final class StageRecorder {
  static let videoWidth = 2160
  static let videoHeight = 3840
  static let courtSize = 2160
  static let targetSampleRate: Double = 96_000

  private var writer: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var audioInput: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var startedAt: CMTime?
  private var frameIndex: Int64 = 0
  private var audioSampleTime: CMTime = .zero
  private let ciContext = CIContext(options: nil)
  private(set) var outputURL: URL?
  private(set) var isRecording = false
  private var lockedSampleRate: Double = StageRecorder.targetSampleRate

  func start(sampleRate: Double) throws {
    stop(cancel: true)
    lockedSampleRate = sampleRate > 0 ? sampleRate : StageRecorder.targetSampleRate
    let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
    let movies = FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    let url = movies.appendingPathComponent("HoldingTopology-\(stamp).mov")
    if FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }
    let writer = try AVAssetWriter(outputURL: url, fileType: .mov)

    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.hevc,
      AVVideoWidthKey: StageRecorder.videoWidth,
      AVVideoHeightKey: StageRecorder.videoHeight,
    ]
    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    videoInput.expectsMediaDataInRealTime = true

    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: StageRecorder.videoWidth,
        kCVPixelBufferHeightKey as String: StageRecorder.videoHeight,
      ]
    )

    let audioSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: lockedSampleRate,
      AVNumberOfChannelsKey: 2,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
    audioInput.expectsMediaDataInRealTime = true

    guard writer.canAdd(videoInput), writer.canAdd(audioInput) else {
      throw RecorderError.cannotAddInputs
    }
    writer.add(videoInput)
    writer.add(audioInput)
    guard writer.startWriting() else {
      throw writer.error ?? RecorderError.cannotStart
    }
    writer.startSession(atSourceTime: .zero)

    self.writer = writer
    self.videoInput = videoInput
    self.audioInput = audioInput
    self.adaptor = adaptor
    self.outputURL = url
    self.startedAt = .zero
    self.frameIndex = 0
    self.audioSampleTime = .zero
    self.isRecording = true
  }

  func appendFrame(pngDataURL: String) {
    guard isRecording, let videoInput, let adaptor, videoInput.isReadyForMoreMediaData else {
      return
    }
    guard let image = decodePNG(dataURL: pngDataURL) else {
      return
    }
    guard let buffer = makeVerticalPixelBuffer(from: image) else {
      return
    }
    let time = CMTime(value: frameIndex, timescale: 30)
    adaptor.append(buffer, withPresentationTime: time)
    frameIndex += 1
  }

  func appendAudio(interleaved: [Float], sampleRate: Double, channels: Int) {
    guard isRecording, let audioInput, audioInput.isReadyForMoreMediaData, !interleaved.isEmpty else {
      return
    }
    let rate = sampleRate > 0 ? sampleRate : lockedSampleRate
    let frameCount = interleaved.count / max(channels, 1)
    var sampleBuffer: CMSampleBuffer?
    var format: CMAudioFormatDescription?
    var asbd = AudioStreamBasicDescription(
      mSampleRate: rate,
      mFormatID: kAudioFormatLinearPCM,
      mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
      mBytesPerPacket: UInt32(4 * channels),
      mFramesPerPacket: 1,
      mBytesPerFrame: UInt32(4 * channels),
      mChannelsPerFrame: UInt32(channels),
      mBitsPerChannel: 32,
      mReserved: 0
    )
    CMAudioFormatDescriptionCreate(
      allocator: kCFAllocatorDefault,
      asbd: &asbd,
      layoutSize: 0,
      layout: nil,
      magicCookieSize: 0,
      magicCookie: nil,
      extensions: nil,
      formatDescriptionOut: &format
    )
    guard let format else {
      return
    }
    var timing = CMSampleTimingInfo(
      duration: CMTime(value: 1, timescale: CMTimeScale(rate)),
      presentationTimeStamp: audioSampleTime,
      decodeTimeStamp: .invalid
    )
    CMSampleBufferCreate(
      allocator: kCFAllocatorDefault,
      dataBuffer: nil,
      dataReady: false,
      makeDataReadyCallback: nil,
      refcon: nil,
      formatDescription: format,
      sampleCount: frameCount,
      sampleTimingEntryCount: 1,
      sampleTimingArray: &timing,
      sampleSizeEntryCount: 0,
      sampleSizeArray: nil,
      sampleBufferOut: &sampleBuffer
    )
    guard let sampleBuffer else {
      return
    }
    interleaved.withUnsafeBufferPointer { pointer in
      guard let base = pointer.baseAddress else {
        return
      }
      let byteCount = interleaved.count * MemoryLayout<Float>.size
      var blockBuffer: CMBlockBuffer?
      CMBlockBufferCreateWithMemoryBlock(
        allocator: kCFAllocatorDefault,
        memoryBlock: nil,
        blockLength: byteCount,
        blockAllocator: kCFAllocatorDefault,
        customBlockSource: nil,
        offsetToData: 0,
        dataLength: byteCount,
        flags: 0,
        blockBufferOut: &blockBuffer
      )
      guard let blockBuffer else {
        return
      }
      CMBlockBufferReplaceDataBytes(
        with: base,
        blockBuffer: blockBuffer,
        offsetIntoDestination: 0,
        dataLength: byteCount
      )
      CMSampleBufferSetDataBuffer(sampleBuffer, newValue: blockBuffer)
      audioInput.append(sampleBuffer)
    }
    audioSampleTime = CMTimeAdd(
      audioSampleTime,
      CMTime(value: CMTimeValue(frameCount), timescale: CMTimeScale(rate))
    )
  }

  @discardableResult
  func stop(cancel: Bool = false) -> URL? {
    guard isRecording else {
      return cancel ? nil : outputURL
    }
    isRecording = false
    videoInput?.markAsFinished()
    audioInput?.markAsFinished()
    let url = outputURL
    let writer = self.writer
    self.writer = nil
    self.videoInput = nil
    self.audioInput = nil
    self.adaptor = nil
    if cancel {
      writer?.cancelWriting()
      if let url {
        try? FileManager.default.removeItem(at: url)
      }
      outputURL = nil
      return nil
    }
    let semaphore = DispatchSemaphore(value: 0)
    writer?.finishWriting {
      semaphore.signal()
    }
    _ = semaphore.wait(timeout: .now() + 30)
    return url
  }

  private func decodePNG(dataURL: String) -> NSImage? {
    guard let comma = dataURL.firstIndex(of: ","),
          let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
    else {
      return nil
    }
    return NSImage(data: data)
  }

  private func makeVerticalPixelBuffer(from image: NSImage) -> CVPixelBuffer? {
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
      return nil
    }
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      StageRecorder.videoWidth,
      StageRecorder.videoHeight,
      kCVPixelFormatType_32BGRA,
      [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
      ] as CFDictionary,
      &buffer
    )
    guard status == kCVReturnSuccess, let buffer else {
      return nil
    }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: StageRecorder.videoWidth,
      height: StageRecorder.videoHeight,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else {
      return nil
    }
    context.setFillColor(NSColor.black.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: StageRecorder.videoWidth, height: StageRecorder.videoHeight))
    let court = CGFloat(StageRecorder.courtSize)
    let x = (CGFloat(StageRecorder.videoWidth) - court) / 2
    let y = (CGFloat(StageRecorder.videoHeight) - court) / 2
    context.interpolationQuality = .none
    context.draw(cgImage, in: CGRect(x: x, y: y, width: court, height: court))
    return buffer
  }

  enum RecorderError: Error {
    case cannotAddInputs
    case cannotStart
  }
}
