// FEDERATION CONFIG - Auto-synced from ECHO-001
// DO NOT EDIT MANUALLY

export const FEDERATION_CONFIG = {
  CORE_URL: 'https://yokxmlatktvxqymxtktn.supabase.co',
  SYNC_KEY_NAME: 'FEDERATED_SYNC_KEY',
  SYNC_ENDPOINT: '/functions/v1/federation-receiver',
  HEARTBEAT_INTERVAL_MS: 30000,
  FEDERATION_TIMEOUT_MS: 3000,
  VERSION: '2.0.0',
  SATELLITE_COUNT: 27,
  SOVEREIGN_CAPABILITIES: [
    'local_reasoning',
    'grls_rehydration',
    'memory_persistence',
    'governance_enforcement',
    'sync_queue',
    'parallel_execution',
    'distributed_compute'
  ]
} as const;

export default FEDERATION_CONFIG;
