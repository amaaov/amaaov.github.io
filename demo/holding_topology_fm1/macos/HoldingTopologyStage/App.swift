import SwiftUI

@main
struct HoldingTopologyStageApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
    .defaultSize(width: 1080, height: 1920)
    .commands {
      CommandGroup(replacing: .newItem) {}
      CommandMenu("Stage") {
        Button("Chaos") {
          NotificationCenter.default.post(name: .stageChaos, object: nil)
        }
        .keyboardShortcut("k", modifiers: [.command])
        Button("New Patch") {
          NotificationCenter.default.post(name: .stageNewPatch, object: nil)
        }
        .keyboardShortcut("n", modifiers: [.command])
        Button("Toggle Record") {
          NotificationCenter.default.post(name: .stageToggleRecord, object: nil)
        }
        .keyboardShortcut("r", modifiers: [.command])
      }
    }
  }
}

extension Notification.Name {
  static let stageChaos = Notification.Name("ht.stage.chaos")
  static let stageNewPatch = Notification.Name("ht.stage.newPatch")
  static let stageToggleRecord = Notification.Name("ht.stage.toggleRecord")
}
