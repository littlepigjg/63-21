import { useState, useCallback, useEffect } from 'react';
import { ScrollText, Settings, Eye, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLogs } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import LogContextTimeline from '@/components/LogContextTimeline';
import { formatTime, logTypeLabel, logTypeColor, contextInfoTypeLabel } from '@/utils/format';
import type { LogContext, LogContextConfig, ContextInfoType, LogEntry } from '../../shared/types';
import { ALL_CONTEXT_INFO_TYPES } from '../../shared/types';

const LOG_TYPES = [
  { value: '', label: '全部' },
  { value: 'pull', label: '拉取配置' },
  { value: 'change', label: '配置变更' },
  { value: 'encrypt', label: '加密' },
  { value: 'decrypt', label: '解密' },
  { value: 'client_register', label: '客户端注册' },
  { value: 'notify', label: '通知推送' },
  { value: 'error', label: '错误' },
];

export default function Logs() {
  const {
    logs,
    total,
    totalPages,
    loading,
    typeFilter,
    setTypeFilter,
    page,
    setPage,
    fetchLogContext,
    fetchContextConfig,
    updateContextConfig,
    triggerContextCleanup,
  } = useLogs();

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [currentContext, setCurrentContext] = useState<LogContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [currentErrorLog, setCurrentErrorLog] = useState<LogEntry | null>(null);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [contextConfig, setContextConfig] = useState<LogContextConfig | null>(null);
  const [configStats, setConfigStats] = useState<{ total: number; expired: number } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const handleViewContext = useCallback(
    async (log: LogEntry) => {
      setCurrentErrorLog(log);
      setContextModalOpen(true);
      setContextLoading(true);
      setContextError(null);
      setCurrentContext(null);

      const context = await fetchLogContext(log.id);
      if (context) {
        setCurrentContext(context);
      } else {
        setContextError('未找到上下文数据。上下文可能尚未生成或已过期（超过保留期限）。');
      }
      setContextLoading(false);
    },
    [fetchLogContext],
  );

  const handleOpenConfig = useCallback(async () => {
    setConfigModalOpen(true);
    setConfigLoading(true);
    setConfigSaved(false);
    setCleanupResult(null);

    const result = await fetchContextConfig();
    if (result) {
      setContextConfig(result.config);
      setConfigStats(result.stats);
    }
    setConfigLoading(false);
  }, [fetchContextConfig]);

  const handleSaveConfig = useCallback(async () => {
    if (!contextConfig) return;
    setConfigSaving(true);
    setConfigSaved(false);
    const updated = await updateContextConfig({
      enabled: contextConfig.enabled,
      timeWindowBefore: contextConfig.timeWindowBefore,
      timeWindowAfter: contextConfig.timeWindowAfter,
      infoTypes: contextConfig.infoTypes,
      retentionDays: contextConfig.retentionDays,
    });
    if (updated) {
      setContextConfig(updated);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    }
    setConfigSaving(false);
  }, [contextConfig, updateContextConfig]);

  const handleCleanup = useCallback(async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    const removed = await triggerContextCleanup();
    setCleanupResult(`已清理 ${removed} 条过期上下文`);
    const result = await fetchContextConfig();
    if (result) {
      setConfigStats(result.stats);
    }
    setCleanupLoading(false);
    setTimeout(() => setCleanupResult(null), 3000);
  }, [triggerContextCleanup, fetchContextConfig]);

  const toggleInfoType = (type: ContextInfoType) => {
    if (!contextConfig) return;
    const has = contextConfig.infoTypes.includes(type);
    setContextConfig({
      ...contextConfig,
      infoTypes: has
        ? contextConfig.infoTypes.filter((t) => t !== type)
        : [...contextConfig.infoTypes, type],
    });
  };

  useEffect(() => {
    if (!configModalOpen) {
      setConfigSaved(false);
      setCleanupResult(null);
    }
  }, [configModalOpen]);

  return (
    <div className="animate-slide-in">
      <PageHeader title="操作日志" subtitle="查看所有配置操作和客户端拉取记录" />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1 flex-wrap">
          {LOG_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value as typeof typeFilter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#64748B]">共 {total} 条记录</span>
        <button
          onClick={handleOpenConfig}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] hover:text-[#F1F5F9] transition-colors ml-auto"
        >
          <Settings className="w-3.5 h-3.5" />
          上下文设置
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="text-center py-16 text-[#64748B]">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
          <p>加载中...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-[#64748B]">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无日志记录</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">时间</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">类型</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">客户端</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">项目/环境</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">详情</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr
                  key={`${log.id}-${idx}`}
                  className={`border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors ${
                    idx % 2 === 1 ? 'bg-[#0F172A]/20' : ''
                  } ${log.type === 'error' ? 'bg-red-500/5' : ''}`}
                >
                  <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{formatTime(log.timestamp)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${logTypeColor(log.type)}`}
                    >
                      {logTypeLabel(log.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-[#94A3B8]">{log.clientName || '-'}</div>
                    <div className="text-[10px] text-[#64748B]">{log.clientIp || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {log.project ? `${log.project}${log.environment ? '/' + log.environment : ''}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8] max-w-[300px] truncate">{log.detail}</td>
                  <td className="px-4 py-3">
                    {log.type === 'error' ? (
                      <button
                        onClick={() => handleViewContext(log)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-3 h-3" />
                        查看上下文
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#334155]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] disabled:opacity-50 transition-colors"
          >
            上一页
          </button>
          <span className="text-xs text-[#64748B]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] disabled:opacity-50 transition-colors"
          >
            下一页
          </button>
        </div>
      )}

      <Modal
        open={contextModalOpen}
        onClose={() => setContextModalOpen(false)}
        title="错误上下文时间线"
        maxWidth="max-w-3xl"
        scrollable
      >
        {currentErrorLog && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">错误事件</span>
              <span className="text-[10px] text-[#64748B]">{formatTime(currentErrorLog.timestamp)}</span>
            </div>
            <div className="text-sm text-[#F1F5F9]">{currentErrorLog.detail}</div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-[#64748B]">
              {currentErrorLog.clientName && <span>客户端: {currentErrorLog.clientName}</span>}
              {currentErrorLog.clientIp && <span>IP: {currentErrorLog.clientIp}</span>}
              {currentErrorLog.project && <span>项目: {currentErrorLog.project}</span>}
            </div>
          </div>
        )}

        {contextLoading ? (
          <div className="flex items-center justify-center py-12 text-[#64748B]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">正在加载上下文数据...</span>
          </div>
        ) : contextError ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">{contextError}</p>
          </div>
        ) : currentContext ? (
          <LogContextTimeline context={currentContext} />
        ) : null}
      </Modal>

      <Modal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="上下文关联设置"
        maxWidth="max-w-xl"
        scrollable
      >
        {configLoading ? (
          <div className="flex items-center justify-center py-12 text-[#64748B]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : contextConfig ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[#F1F5F9] font-medium">启用上下文关联</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">错误日志出现时自动生成上下文</div>
              </div>
              <button
                onClick={() => setContextConfig({ ...contextConfig, enabled: !contextConfig.enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  contextConfig.enabled ? 'bg-emerald-500' : 'bg-[#334155]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    contextConfig.enabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">关联时间窗口 - 前（秒）</label>
                <input
                  type="number"
                  min={0}
                  value={Math.round(contextConfig.timeWindowBefore / 1000)}
                  onChange={(e) =>
                    setContextConfig({
                      ...contextConfig,
                      timeWindowBefore: Math.max(0, parseInt(e.target.value) || 0) * 1000,
                    })
                  }
                  disabled={!contextConfig.enabled}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] mb-1 block">关联时间窗口 - 后（秒）</label>
                <input
                  type="number"
                  min={0}
                  value={Math.round(contextConfig.timeWindowAfter / 1000)}
                  onChange={(e) =>
                    setContextConfig({
                      ...contextConfig,
                      timeWindowAfter: Math.max(0, parseInt(e.target.value) || 0) * 1000,
                    })
                  }
                  disabled={!contextConfig.enabled}
                  className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#94A3B8] mb-2 block">关联信息类型</label>
              <div className="space-y-2">
                {ALL_CONTEXT_INFO_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      contextConfig.infoTypes.includes(type)
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-[#334155] bg-[#0F172A]/50'
                    } ${!contextConfig.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={contextConfig.infoTypes.includes(type)}
                      onChange={() => toggleInfoType(type)}
                      disabled={!contextConfig.enabled}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="text-sm text-[#F1F5F9]">{contextInfoTypeLabel(type)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">数据保留天数</label>
              <input
                type="number"
                min={1}
                value={contextConfig.retentionDays}
                onChange={(e) =>
                  setContextConfig({
                    ...contextConfig,
                    retentionDays: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                disabled={!contextConfig.enabled}
                className="w-full bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
              />
              <div className="text-[10px] text-[#64748B] mt-1">超期上下文数据将自动清理</div>
            </div>

            {configStats && (
              <div className="flex items-center gap-4 p-3 bg-[#0F172A] rounded-lg">
                <div className="flex-1">
                  <div className="text-[10px] text-[#64748B]">已存储上下文</div>
                  <div className="text-lg font-bold text-[#F1F5F9]">{configStats.total}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-[#64748B]">已过期</div>
                  <div className="text-lg font-bold text-amber-400">{configStats.expired}</div>
                </div>
                <button
                  onClick={handleCleanup}
                  disabled={cleanupLoading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {cleanupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  立即清理
                </button>
              </div>
            )}

            {cleanupResult && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {cleanupResult}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#334155]">
              {configSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已保存
                </span>
              )}
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                保存设置
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-[#64748B] text-sm">加载配置失败</div>
        )}
      </Modal>
    </div>
  );
}
