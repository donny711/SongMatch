const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Remove the `aps-environment` entitlement that expo-notifications injects.
 *
 * Phase 1 uses LOCAL notifications only (no remote push), which do NOT require
 * this entitlement. Keeping it forces the code-signing provisioning profile to
 * carry the Push Notifications capability — which broke the manual-signed
 * Codemagic archive:
 *   error: Provisioning profile "SongMatch" doesn't include the Push
 *          Notifications capability / aps-environment entitlement.
 *
 * Stripping it means the app requires no push capability, so the existing
 * Distribution profile signs cleanly. This plugin MUST be listed BEFORE
 * "expo-notifications" in app.json `plugins`: Expo composes entitlements mods
 * so the LATER-registered action runs FIRST, so listing the strip earlier makes
 * its delete run AFTER expo-notifications adds the entitlement. (Verified by
 * executing the composed mod chain.)
 *
 * Phase 2 (remote/social push): remove this plugin, enable Push Notifications
 * on the App ID, and regenerate the provisioning profile.
 */
module.exports = function stripApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
