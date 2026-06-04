const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const OBJC_FILENAME = 'SMFatalHandler.m';
const OBJC_CONTENT = `#import <React/RCTAssert.h>

@interface SMFatalHandler : NSObject
@end

@implementation SMFatalHandler
+ (void)load {
    RCTSetFatalHandler(^(NSError *error) {
        NSLog(@"[SongMatch] RCTFatal intercepted (not crashing): %@", error.localizedDescription);
    });
}
@end
`;

function withIOSFatalHandler(config) {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      const appName = cfg.modRequest.projectName;
      const filePath = path.join(iosDir, appName, OBJC_FILENAME);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, OBJC_CONTENT);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const appName = cfg.modRequest.projectName;
    const relativePath = appName + '/' + OBJC_FILENAME;

    if (project.hasFile(relativePath)) {
      return cfg;
    }

    const groupKey = project.findPBXGroupKey({ name: appName });
    const target = project.getFirstTarget();
    project.addSourceFile(relativePath, { target: target.uuid }, groupKey);

    return cfg;
  });

  return config;
}

module.exports = withIOSFatalHandler;
