/**
 * BETA TEST MODE NOTICE
 * Cyberellum Federation Satellite
 * Last Updated: 2025-12-26
 */

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const BetaNotice = () => (
  <Alert className="fixed bottom-4 right-4 max-w-md z-50 bg-amber-500/10 border-amber-500/50 text-amber-100">
    <AlertTriangle className="h-4 w-4 text-amber-500" />
    <AlertDescription className="text-xs">
      <strong>BETA TEST MODE</strong> — This satellite is currently in pre-production. Features and functions are being updated and tested. Powered by Cyberellum ACIP Federation.
    </AlertDescription>
  </Alert>
);

export default BetaNotice;