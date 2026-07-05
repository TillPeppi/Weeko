const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Removes the `aps-environment` (Push Notifications) entitlement that the
 * expo-notifications config plugin adds unconditionally.
 *
 * Weeko only uses LOCAL scheduled notifications (see src/notifications/scheduler.ts),
 * which do not require the Push Notifications capability on iOS. Keeping the
 * entitlement breaks device builds signed with a free/personal Apple team, which
 * cannot provision Push Notifications.
 *
 * If remote push is ever added, remove this plugin from app.json.
 */
module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
