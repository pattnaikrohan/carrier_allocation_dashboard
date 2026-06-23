import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as StaticData from '../BookingData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDataState {
  BOOKING_LOG_DATA: any[];
  WEEKLY_TREND_DATA: any[];
  BRANCH_SNAPSHOT: any[];
  CONTRACT_UTIL_DATA: any[];
  ORIGINS: string[];
  DESTINATIONS: string[];
  REGIONS: string[];
  COUNTRIES: string[];
  PORT_HIERARCHY: any[];
  QUARTERLY_ALLOC_UTIL?: any[];
  CARRIER_BREAKDOWN?: any[];
  CONTRACTS?: string[];
  WEEKS?: string[];
}

interface BookingDataContextType extends BookingDataState {
  /** Trigger a sync from Azure Blob → backend → update in-memory data */
  syncData: () => Promise<{ status: string; message: string }>;
  /** Fetch latest processed data from backend (no Azure re-processing) */
  refreshData: () => Promise<void>;
  /** Whether a sync/fetch is currently in progress */
  isFetching: boolean;
  /** Timestamp of last successful data refresh */
  lastSynced: string | null;
}

// ─── Defaults (from static BookingData.ts) ────────────────────────────────────

const defaultData: BookingDataState = {
  BOOKING_LOG_DATA: StaticData.BOOKING_LOG_DATA ?? [],
  WEEKLY_TREND_DATA: (StaticData as any).WEEKLY_TREND_DATA ?? [],
  BRANCH_SNAPSHOT: (StaticData as any).BRANCH_SNAPSHOT ?? [],
  CONTRACT_UTIL_DATA: (StaticData as any).CONTRACT_UTIL_DATA ?? [],
  ORIGINS: (StaticData as any).ORIGINS ?? [],
  DESTINATIONS: (StaticData as any).DESTINATIONS ?? [],
  REGIONS: (StaticData as any).REGIONS ?? [],
  COUNTRIES: (StaticData as any).COUNTRIES ?? [],
  PORT_HIERARCHY: (StaticData as any).PORT_HIERARCHY ?? [],
  QUARTERLY_ALLOC_UTIL: (StaticData as any).QUARTERLY_ALLOC_UTIL ?? [],
  CARRIER_BREAKDOWN: (StaticData as any).CARRIER_BREAKDOWN ?? [],
  CONTRACTS: (StaticData as any).CONTRACTS ?? [],
  WEEKS: (StaticData as any).WEEKS ?? [],
};

// ─── API helpers ──────────────────────────────────────────────────────────────

function getApiBase(): string {
  // Always point to the live Azure API for real blob data
  return 'https://carrier-allocation-dashboard.azurewebsites.net';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const BookingDataContext = createContext<BookingDataContextType | null>(null);

export const BookingDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<BookingDataState>(defaultData);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  /** Apply a server response's data payload into state */
  const applyData = useCallback((payload: Record<string, any>) => {
    setData({
      BOOKING_LOG_DATA: payload.BOOKING_LOG_DATA ?? defaultData.BOOKING_LOG_DATA,
      WEEKLY_TREND_DATA: payload.WEEKLY_TREND_DATA ?? defaultData.WEEKLY_TREND_DATA,
      BRANCH_SNAPSHOT: payload.BRANCH_SNAPSHOT ?? defaultData.BRANCH_SNAPSHOT,
      CONTRACT_UTIL_DATA: payload.CONTRACT_UTIL_DATA ?? defaultData.CONTRACT_UTIL_DATA,
      ORIGINS: payload.ORIGINS ?? defaultData.ORIGINS,
      DESTINATIONS: payload.DESTINATIONS ?? defaultData.DESTINATIONS,
      REGIONS: payload.REGIONS ?? defaultData.REGIONS,
      COUNTRIES: payload.COUNTRIES ?? defaultData.COUNTRIES,
      PORT_HIERARCHY: payload.PORT_HIERARCHY ?? defaultData.PORT_HIERARCHY,
      QUARTERLY_ALLOC_UTIL: payload.QUARTERLY_ALLOC_UTIL ?? defaultData.QUARTERLY_ALLOC_UTIL,
      CARRIER_BREAKDOWN: payload.CARRIER_BREAKDOWN ?? defaultData.CARRIER_BREAKDOWN,
      CONTRACTS: payload.CONTRACTS ?? defaultData.CONTRACTS,
      WEEKS: payload.WEEKS ?? defaultData.WEEKS,
    });
    setLastSynced(new Date().toISOString());
  }, []);

  /** POST /api/sync — triggers Azure Blob processing, returns fresh data */
  const syncData = useCallback(async (): Promise<{ status: string; message: string }> => {
    setIsFetching(true);
    try {
      const res = await fetch(`${getApiBase()}/api/sync`, { method: 'POST' });
      const json = await res.json();

      if ((json.status === 'success' || json.status === 'partial') && json.data) {
        applyData(json.data);
      }

      return { status: json.status, message: json.message };
    } catch (err: any) {
      return { status: 'error', message: `Could not connect to sync service: ${err.message}` };
    } finally {
      setIsFetching(false);
    }
  }, [applyData]);

  /** GET /api/data — fetch latest processed data without re-triggering Azure processing */
  const refreshData = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`${getApiBase()}/api/data`);
      const json = await res.json();

      if (json.status === 'success' && json.data) {
        applyData(json.data);
      }
    } catch {
      // Silently fall back to static data — the dashboard still works
      console.warn('Could not fetch live data from backend. Using static fallback.');
    } finally {
      setIsFetching(false);
    }
  }, [applyData]);

  // Fetch live data on initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <BookingDataContext.Provider
      value={{
        ...data,
        syncData,
        refreshData,
        isFetching,
        lastSynced,
      }}
    >
      {children}
    </BookingDataContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBookingData(): BookingDataContextType {
  const ctx = useContext(BookingDataContext);
  if (!ctx) {
    throw new Error('useBookingData must be used within a <BookingDataProvider>');
  }
  return ctx;
}
