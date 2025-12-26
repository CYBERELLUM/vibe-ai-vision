import React from 'react';
import { Construction, Calendar, Rocket } from 'lucide-react';

const PreProductionBanner: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-900/95 via-amber-800/95 to-amber-900/95 backdrop-blur-sm border-b border-amber-500/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-amber-100">
          <Construction className="h-5 w-5 text-amber-400 animate-pulse" />
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center">
            <span className="font-semibold text-amber-200">
              Pre-Production Environment
            </span>
            <span className="hidden sm:inline text-amber-400">|</span>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-300" />
              <span className="text-sm">
                Target Go-Live: Mid-January 2026
              </span>
            </div>
          </div>
          <Rocket className="h-5 w-5 text-amber-400" />
        </div>
        <p className="text-center text-xs text-amber-200/80 mt-1">
          This platform is currently under active development. We are not accepting customers at this time.
        </p>
      </div>
    </div>
  );
};

export default PreProductionBanner;