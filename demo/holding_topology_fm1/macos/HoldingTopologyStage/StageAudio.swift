import AVFoundation
import Foundation

final class StageAudio {
  var onRender: ((UnsafeMutablePointer<Float>, Int) -> Void)?
  private(set) var isRunning = false
  private(set) var lastError: String?

  private let engine = AVAudioEngine()
  private let sampleRate: Double
  private var source: AVAudioSourceNode?
  private var scratch: UnsafeMutablePointer<Float>
  private var scratchFrames = 0

  init(sampleRate: Double) {
    self.sampleRate = sampleRate
    self.scratch = UnsafeMutablePointer<Float>.allocate(capacity: 4096 * 2)
    self.scratchFrames = 4096
  }

  deinit {
    scratch.deallocate()
  }

  func start() {
    lastError = nil
    /* Must match HT_DSP_SAMPLE_RATE (96 kHz). Engine converts down to hardware. */
    let format = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: sampleRate,
      channels: 2,
      interleaved: false
    )
    guard let format else {
      lastError = "bad audio format"
      isRunning = false
      return
    }
    let source = AVAudioSourceNode(format: format) { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
      guard let self else {
        return noErr
      }
      let frames = Int(frameCount)
      self.ensureScratch(frames: frames)
      memset(self.scratch, 0, frames * 2 * MemoryLayout<Float>.size)
      self.onRender?(self.scratch, frames)
      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      if abl.count >= 2,
         let left = abl[0].mData?.assumingMemoryBound(to: Float.self),
         let right = abl[1].mData?.assumingMemoryBound(to: Float.self)
      {
        for index in 0 ..< frames {
          left[index] = self.scratch[index * 2]
          right[index] = self.scratch[index * 2 + 1]
        }
      } else if abl.count >= 1,
                let mono = abl[0].mData?.assumingMemoryBound(to: Float.self)
      {
        /* Fallback: fold stereo to whatever buffer the host gave. */
        for index in 0 ..< frames {
          mono[index] = 0.5 * (self.scratch[index * 2] + self.scratch[index * 2 + 1])
        }
      }
      return noErr
    }
    self.source = source
    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
    engine.mainMixerNode.outputVolume = 1
    engine.mainMixerNode.pan = 0
    do {
      try engine.start()
      isRunning = true
    } catch {
      lastError = error.localizedDescription
      isRunning = false
    }
  }

  func stop() {
    engine.stop()
    if let source {
      engine.detach(source)
    }
    source = nil
    isRunning = false
  }

  private func ensureScratch(frames: Int) {
    if frames <= scratchFrames {
      return
    }
    scratch.deallocate()
    scratch = UnsafeMutablePointer<Float>.allocate(capacity: frames * 2)
    scratchFrames = frames
  }
}
