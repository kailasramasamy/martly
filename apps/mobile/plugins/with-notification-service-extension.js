// iOS shows a push's image only if a Notification Service Extension downloads and attaches it.
// FCM puts the image URL in `fcm_options.image` (the API sends it with mutable-content), so the
// extension needs no Firebase SDK: it reads the URL, downloads it and attaches it before display.
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const TARGET = "NotificationService";

const SWIFT = `import UserNotifications

class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    self.contentHandler = contentHandler
    bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent
    guard let content = bestAttempt,
          let options = request.content.userInfo["fcm_options"] as? [String: Any],
          let link = options["image"] as? String,
          let url = URL(string: link) else {
      contentHandler(request.content)
      return
    }
    URLSession.shared.downloadTask(with: url) { location, response, _ in
      if let location = location, let attachment = Self.attachment(from: location, mimeType: response?.mimeType) {
        content.attachments = [attachment]
      }
      contentHandler(content)
    }.resume()
  }

  // iOS cuts the extension off after ~30s; show the text-only notification rather than nothing
  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let content = bestAttempt { contentHandler(content) }
  }

  private static func attachment(from location: URL, mimeType: String?) -> UNNotificationAttachment? {
    let ext = mimeType == "image/png" ? "png" : mimeType == "image/gif" ? "gif" : "jpg"
    let file = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString + "." + ext)
    guard (try? FileManager.default.moveItem(at: location, to: file)) != nil else { return nil }
    return try? UNNotificationAttachment(identifier: "image", url: file)
  }
}
`;

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key><string>${TARGET}</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key><string>com.apple.usernotifications.service</string>
    <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).NotificationService</string>
  </dict>
</dict>
</plist>
`;

function withExtensionFiles(config) {
  return withDangerousMod(config, ["ios", (mod) => {
    const dir = path.join(mod.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "NotificationService.swift"), SWIFT);
    fs.writeFileSync(path.join(dir, `${TARGET}-Info.plist`), INFO_PLIST);
    return mod;
  }]);
}

/** The app target's build setting, so the extension builds with the same team, versions and iOS floor */
function appSetting(project, key) {
  const configs = project.pbxXCBuildConfigurationSection();
  const app = Object.values(configs).find((c) => c.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER && c.buildSettings?.[key] !== undefined && !String(c.buildSettings.PRODUCT_BUNDLE_IDENTIFIER).includes(TARGET));
  return app?.buildSettings[key];
}

/**
 * addTarget appends the "embed extension" Copy Files phase last, after the React Native bundle and CocoaPods
 * script phases, which Xcode reports as "Cycle inside Martly". Embedding right after Resources avoids it.
 */
function embedAfterResources(project) {
  const app = project.getFirstTarget().firstTarget;
  const phases = app.buildPhases;
  const embed = phases.findIndex((p) => p.comment === "Copy Files");
  if (embed === -1) return;
  const [phase] = phases.splice(embed, 1);
  phases.splice(phases.findIndex((p) => p.comment === "Resources") + 1, 0, phase);
}

function withExtensionTarget(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    if (project.pbxTargetByName(TARGET)) return mod;

    const bundleId = `${config.ios.bundleIdentifier}.${TARGET}`;
    const target = project.addTarget(TARGET, "app_extension", TARGET, bundleId);
    const group = project.addPbxGroup(["NotificationService.swift", `${TARGET}-Info.plist`], TARGET, TARGET);
    // The xcode library writes `= undefined` for fields it can't fill (file types, encodings); drop them
    for (const ref of Object.values(project.pbxFileReferenceSection())) {
      if (typeof ref !== "object") continue;
      for (const key of Object.keys(ref)) if (ref[key] === undefined) delete ref[key];
    }
    const mainGroup = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroup);
    embedAfterResources(project);
    project.addBuildPhase(["NotificationService.swift"], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    const inherited = ["DEVELOPMENT_TEAM", "IPHONEOS_DEPLOYMENT_TARGET", "MARKETING_VERSION", "CURRENT_PROJECT_VERSION"];
    const configs = project.pbxXCBuildConfigurationSection();
    for (const cfg of Object.values(configs)) {
      if (cfg.buildSettings?.PRODUCT_NAME !== `"${TARGET}"`) continue;
      Object.assign(cfg.buildSettings, {
        SWIFT_VERSION: "5.0",
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_STYLE: "Automatic",
        PRODUCT_BUNDLE_PACKAGE_TYPE: '"XPC!"',
      });
      for (const key of inherited) {
        const value = appSetting(project, key);
        if (value !== undefined) cfg.buildSettings[key] = value;
      }
    }
    return mod;
  });
}

module.exports = function withNotificationServiceExtension(config) {
  return withExtensionTarget(withExtensionFiles(config));
};
