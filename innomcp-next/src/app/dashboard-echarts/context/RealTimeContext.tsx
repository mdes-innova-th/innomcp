import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface RealTimeData {
  [key: string]: unknown;
}

interface RealTimeContextType {
  data: RealTimeData | null;
  lastUpdateTime: Date | null;
  updateData: (newData: RealTimeData) => void;
  clearData: () => void;
  isUpdated: boolean;
  markAsRead: () => void;
  isRealtimeEnabled: boolean;
  setRealtimeEnabled: (enabled: boolean) => void;
}

const RealTimeContext = createContext<RealTimeContextType | null>(null);

interface RealTimeProviderProps {
  children: ReactNode;
}

export function RealTimeProvider({ children }: RealTimeProviderProps) {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isUpdated, setIsUpdated] = useState(false);
  const [isRealtimeEnabled, setRealtimeEnabled] = useState(false);

  const updateData = useCallback((newData: RealTimeData) => {
    setData(newData);
    setLastUpdateTime(new Date());
    setIsUpdated(true);
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setLastUpdateTime(null);
    setIsUpdated(false);
  }, []);

  const markAsRead = useCallback(() => {
    setIsUpdated(false);
  }, []);

  const contextValue: RealTimeContextType = {
    data,
    lastUpdateTime,
    updateData,
    clearData,
    isUpdated,
    markAsRead,
    isRealtimeEnabled,
    setRealtimeEnabled,
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}

export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error("useRealTime must be used within a RealTimeProvider");
  }
  return context;
}
