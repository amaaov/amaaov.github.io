import AppKit
import SwiftUI

struct ContentView: View {
  @StateObject private var stage = StageController(sampleRate: 96_000)

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()
      if let image = stage.courtImage {
        Image(nsImage: image)
          .interpolation(.none)
          .resizable()
          .scaledToFit()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .padding(24)
          .id(stage.frameSerial)
      }
      VStack {
        Spacer()
        Text(stage.status)
          .font(.system(size: 11, weight: .medium, design: .default))
          .foregroundStyle(Color.white.opacity(0.35))
          .padding(.bottom, 10)
      }
    }
    .focusable()
    .onTapGesture {
      /* Click = next scene/sound; soft chaos stays on other keys. */
      stage.newPatch()
    }
    .onKeyPress(phases: .down) { press in
      if press.key == .space {
        stage.newPatch()
        return .handled
      }
      if press.modifiers.contains(.command), press.key == KeyEquivalent("r") {
        stage.toggleRecord()
        return .handled
      }
      stage.chaos()
      return .handled
    }
    .onAppear {
      NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .mouseEntered, .mouseExited]) { _ in
        /* pointer move must not change parameters */
        return nil
      }
    }
    .background(Color.black)
  }
}
