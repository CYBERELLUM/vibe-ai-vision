/**
 * Federation Hook - Connects satellite to ECHO-001 Core
 * Provides sync, health check, and doctrine compliance
 */

import { useState, useEffect, useCallback } from 'react';

const FEDERATION_ENDPOINT = 'https://yokxmlatktvxqymxtktn.supabase.co/functions/v1';

interface FederationState {
  connected: boolean;
  lastSync: string | null;
  doctrineVersion: string;
  coreStatus: 'online' | 'offline' | 'degraded';
}

export const useFederation = (satelliteId: string) => {
  const [state, setState] = useState<FederationState>({
    connected: false,
    lastSync: null,
    doctrineVersion: '2.0.0',
    coreStatus: 'offline'
  });
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${FEDERATION_ENDPOINT}/neural-link-ipc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          satellite_id: satelliteId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          connected: true,
          coreStatus: 'online',
          lastSync: new Date().toISOString()
        }));
        return true;
      }
    } catch (error) {
      console.warn('[Federation] Connection check failed:', error);
    }
    setState(prev => ({ ...prev, connected: false, coreStatus: 'offline' }));
    return false;
  }, [satelliteId]);

  const syncWithCore = useCallback(async (data: Record<string, unknown>) => {
    try {
      const response = await fetch(`${FEDERATION_ENDPOINT}/cross-app-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_app: satelliteId,
          target_app: 'echo-001',
          sync_type: 'knowledge',
          payload: data
        })
      });
      
      if (response.ok) {
        setState(prev => ({ ...prev, lastSync: new Date().toISOString() }));
        return true;
      }
    } catch (error) {
      console.error('[Federation] Sync failed:', error);
    }
    return false;
  }, [satelliteId]);

  useEffect(() => {
    checkConnection().finally(() => setLoading(false));
    const interval = setInterval(checkConnection, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    ...state,
    loading,
    checkConnection,
    syncWithCore
  };
};

export default useFederation;