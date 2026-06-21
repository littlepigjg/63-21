import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import { useSSE } from './useSSE';
import { useDocumentVisibility } from './useDocumentVisibility';
import type { LogEntry, LogType, LogContext, LogContextConfig, ContextInfoType } from '../../shared/types';

interface UseLogsOptions {
  autoRefresh?: boolean;
  refreshOnVisible?: boolean;
  pageSize?: number;
}

interface LogsResult {
  logs: LogEntry[];
  total: number;
}

interface ContextConfigResult {
  config: LogContextConfig;
  stats: { total: number; expired: number };
  availableInfoTypes: ContextInfoType[];
}

export function useLogs(options: UseLogsOptions = {}) {
  const { autoRefresh = true, refreshOnVisible = true, pageSize = 20 } = options;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<LogType | ''>('');
  const [page, setPage] = useState(0);
  const { isVisible } = useDocumentVisibility();
  const lastFetchRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000;

  const fetchLogs = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());
      const res = await api.get<LogsResult>(`/logs?${params.toString()}`);
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page, pageSize]);

  const fetchRecentLogs = useCallback(async (count: number = 10) => {
    try {
      const res = await api.get<LogEntry[]>(`/logs/recent?count=${count}`);
      if (res.success && res.data) {
        return res.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const fetchLogContext = useCallback(async (errorLogId: string): Promise<LogContext | null> => {
    try {
      const res = await api.get<LogContext>(`/logs/contexts/${errorLogId}`);
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchContextConfig = useCallback(async (): Promise<ContextConfigResult | null> => {
    try {
      const res = await api.get<ContextConfigResult>('/logs/contexts/config');
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const updateContextConfig = useCallback(async (config: Partial<LogContextConfig>): Promise<LogContextConfig | null> => {
    try {
      const res = await api.put<LogContextConfig>('/logs/contexts/config', config);
      if (res.success && res.data) {
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const triggerContextCleanup = useCallback(async (): Promise<number> => {
    try {
      const res = await api.post<{ removed: number }>('/logs/contexts/cleanup');
      if (res.success && res.data) {
        return res.data.removed;
      }
      return 0;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!refreshOnVisible || !isVisible) return;

    const timer = setTimeout(() => {
      lastFetchRef.current = 0;
      fetchLogs();
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, refreshOnVisible, fetchLogs]);

  useSSE({
    enabled: autoRefresh,
    filter: { eventTypes: ['config_changed', 'refresh'] },
    onConfigChanged: () => {
      lastFetchRef.current = 0;
      fetchLogs();
    },
    onRefresh: () => {
      lastFetchRef.current = 0;
      fetchLogs();
    },
  });

  const totalPages = Math.ceil(total / pageSize);

  return {
    logs,
    total,
    totalPages,
    loading,
    error,
    typeFilter,
    setTypeFilter: (type: LogType | '') => {
      setTypeFilter(type);
      setPage(0);
    },
    page,
    setPage,
    fetchLogs,
    fetchRecentLogs,
    fetchLogContext,
    fetchContextConfig,
    updateContextConfig,
    triggerContextCleanup,
  };
}
