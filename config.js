/* Local-first runtime configuration. The retired cloud provider is disabled.
 * Existing cloud state is kept on-device for recovery, but old saved backend
 * settings must never silently reactivate it. A replacement needs its own
 * configured adapter before cross-device synchronization can be enabled. */
window.HOMESTOCK_CONFIG = {
  CLOUD_SYNC_ENABLED: false,
};
