import { useEffect, useRef } from 'react';

interface UseRealtimeUpdatesProps {
  onUpdate: () => void;
  interval?: number;
  enabled?: boolean;
}

export const useRealtimeUpdates = ({ 
  onUpdate, 
  interval = 30000, // 30 seconds
  enabled = true 
}: UseRealtimeUpdatesProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Update the callback ref when onUpdate changes
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Set up the interval
    intervalRef.current = setInterval(() => {
      onUpdateRef.current();
    }, interval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [interval, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
};

export default useRealtimeUpdates;
