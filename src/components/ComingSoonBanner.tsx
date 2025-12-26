/**
 * COMING SOON BANNER WITH COUNTDOWN
 * Cyberellum Federation - Pre-Production Notice
 * Target: Mid-January 2026
 */

import React, { useState, useEffect } from 'react';
import { Construction, Calendar, Rocket, Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const TARGET_DATE = new Date('2026-01-15T00:00:00');

const ComingSoonBanner: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft => {
      const now = new Date();
      const difference = TARGET_DATE.getTime() - now.getTime();
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center min-w-[40px]">
      <span className="text-lg sm:text-xl font-bold text-amber-100 tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase text-amber-300/70">{label}</span>
    </div>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-900/95 via-amber-800/95 to-amber-900/95 backdrop-blur-sm border-b border-amber-500/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-amber-100">
            <Construction className="h-4 w-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-sm text-amber-200">Pre-Production</span>
          </div>
          <span className="hidden sm:inline text-amber-500/50">|</span>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-300" />
            <div className="flex items-center gap-1">
              <CountdownUnit value={timeLeft.days} label="days" />
              <span className="text-amber-400 text-lg font-light">:</span>
              <CountdownUnit value={timeLeft.hours} label="hrs" />
              <span className="text-amber-400 text-lg font-light">:</span>
              <CountdownUnit value={timeLeft.minutes} label="min" />
              <span className="text-amber-400 text-lg font-light">:</span>
              <CountdownUnit value={timeLeft.seconds} label="sec" />
            </div>
          </div>
          <span className="hidden sm:inline text-amber-500/50">|</span>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-300" />
            <span className="text-xs text-amber-200">Go-Live: Jan 2026</span>
            <Rocket className="h-4 w-4 text-amber-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonBanner;