import { useState, useEffect, useCallback } from 'react';
const FEDERATION_ENDPOINT = 'https://yokxmlatktvxqymxtktn.supabase.co/functions/v1';
export const useFederation = (satelliteId: string) => {
  const [state, setState] = useState({ connected: false, lastSync: null as string | null, coreStatus: 'offline' as 'online'|'offline' });
  const [loading, setLoading] = useState(true);
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${FEDERATION_ENDPOINT}/neural-link-ipc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ping', satellite_id: satelliteId }) });
      if (res.ok) { setState({ connected: true, coreStatus: 'online', lastSync: new Date().toISOString() }); return true; }
    } catch (e) { console.warn('[Federation] Check failed:', e); }
    setState(prev => ({ ...prev, connected: false, coreStatus: 'offline' })); return false;
  }, [satelliteId]);
  useEffect(() => { checkConnection().finally(() => setLoading(false)); const i = setInterval(checkConnection, 60000); return () => clearInterval(i); }, [checkConnection]);
  return { ...state, loading, checkConnection };
};
export default useFederation;