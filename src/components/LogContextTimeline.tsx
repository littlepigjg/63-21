import { useMemo } from 'react';
import {
  AlertCircle,
  FileText,
  Server,
  Clock,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { LogContext, ConfigSnapshot, ClientStateSnapshot } from '../../shared/types';
import {
  formatPreciseTime,
  formatTime,
  logTypeLabel,
  logTypeColor,
  envLabel,
  contextInfoTypeLabel,
} from '@/utils/format';

type TimelineKind = 'log' | 'config' | 'client';

interface TimelineItem {
  timestamp: number;
  kind: TimelineKind;
  isError: boolean;
  content: React.ReactNode;
}

export default function LogContextTimeline({ context }: { context: LogContext }) {
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = [];

    for (const log of context.relatedLogs) {
      const isError = log.id === context.errorLogId;
      result.push({
        timestamp: new Date(log.timestamp).getTime(),
        kind: 'log',
        isError,
        content: <LogTimelineItem log={log} isError={isError} />,
      });
    }

    for (const snapshot of context.configSnapshots) {
      result.push({
        timestamp: new Date(snapshot.capturedAt).getTime(),
        kind: 'config',
        isError: false,
        content: <ConfigTimelineItem snapshot={snapshot} />,
      });
    }

    if (context.clientState) {
      result.push({
        timestamp: new Date(context.clientState.capturedAt).getTime(),
        kind: 'client',
        isError: false,
        content: <ClientTimelineItem snapshot={context.clientState} />,
      });
    }

    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }, [context]);

  const onlineCount = context.clientState?.clients.filter((c) => c.online).length ?? 0;
  const offlineCount = context.clientState ? context.clientState.clients.length - onlineCount : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="关联日志"
          value={context.relatedLogs.length}
          icon={FileText}
          color="text-blue-400"
        />
        <SummaryCard
          label="配置快照"
          value={context.configSnapshots.length}
          icon={ShieldCheck}
          color="text-emerald-400"
        />
        <SummaryCard
          label="在线客户端"
          value={onlineCount}
          icon={Wifi}
          color="text-cyan-400"
        />
        <SummaryCard
          label="离线客户端"
          value={offlineCount}
          icon={WifiOff}
          color="text-amber-400"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-[#64748B] bg-[#0F172A] rounded-lg px-3 py-2">
        <Clock className="w-3.5 h-3.5" />
        <span>错误时间: {formatTime(context.errorTimestamp)}</span>
        <span className="text-[#334155]">|</span>
        <span>时间窗口: 前{Math.round(context.config.timeWindowBefore / 1000)}s ~ 后{Math.round(context.config.timeWindowAfter / 1000)}s</span>
        <span className="text-[#334155]">|</span>
        <span>过期时间: {formatTime(context.expiresAt)}</span>
      </div>

      <div className="relative pl-8">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#334155]" />
        <div className="space-y-1">
          {items.map((item, idx) => (
            <TimelineEntry key={idx} item={item} isLast={idx === items.length - 1} />
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-[#64748B] text-sm">暂无关联上下文数据</div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-[#0F172A] border border-[#334155] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-[#64748B]">{label}</span>
      </div>
      <div className="text-lg font-bold text-[#F1F5F9]">{value}</div>
    </div>
  );
}

function TimelineEntry({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const dotColor = item.isError
    ? 'bg-red-500 ring-4 ring-red-500/20'
    : item.kind === 'config'
      ? 'bg-emerald-400'
      : item.kind === 'client'
        ? 'bg-cyan-400'
        : 'bg-[#475569]';

  return (
    <div className={`relative ${isLast ? '' : 'pb-3'}`}>
      <div
        className={`absolute -left-[26px] top-1 w-3 h-3 rounded-full border-2 border-[#1E293B] ${dotColor}`}
      />
      {item.content}
    </div>
  );
}

function LogTimelineItem({
  log,
  isError,
}: {
  log: LogContext['relatedLogs'][number];
  isError: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 transition-colors ${
        isError
          ? 'bg-red-500/10 border border-red-500/30'
          : 'bg-[#0F172A]/50 border border-transparent hover:border-[#334155]'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-0.5">
        <span className="text-[10px] text-[#64748B] font-mono">
          {formatPreciseTime(log.timestamp)}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${logTypeColor(log.type)}`}
        >
          {isError && <AlertCircle className="w-3 h-3" />}
          {logTypeLabel(log.type)}
        </span>
        {isError && (
          <span className="text-[10px] text-red-400 font-medium">错误事件</span>
        )}
      </div>
      <div className="text-xs text-[#94A3B8]">{log.detail}</div>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#64748B]">
        {log.clientName && <span>客户端: {log.clientName}</span>}
        {log.clientIp && <span>IP: {log.clientIp}</span>}
        {log.project && (
          <span>
            项目: {log.project}
            {log.environment && ` / ${envLabel(log.environment)}`}
          </span>
        )}
      </div>
    </div>
  );
}

function ConfigTimelineItem({ snapshot }: { snapshot: ConfigSnapshot }) {
  return (
    <div className="rounded-lg px-3 py-2 bg-emerald-500/5 border border-emerald-500/20">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-[#64748B] font-mono">
          {formatPreciseTime(snapshot.capturedAt)}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
          {contextInfoTypeLabel('configSnapshot')}
        </span>
      </div>
      <div className="text-xs text-[#F1F5F9] font-medium mb-1">
        {snapshot.projectName} / {envLabel(snapshot.environment)}
      </div>
      <div className="space-y-0.5">
        {snapshot.configItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between text-[10px] bg-[#0F172A]/50 rounded px-2 py-1"
          >
            <span className="text-[#94A3B8] font-mono">{item.key}</span>
            <div className="flex items-center gap-2">
              {item.encrypted ? (
                <ShieldOff className="w-3 h-3 text-amber-400" />
              ) : null}
              <span className={item.encrypted ? 'text-amber-400' : 'text-[#64748B]'}>
                {item.encrypted ? '[已加密]' : item.value}
              </span>
            </div>
          </div>
        ))}
        {snapshot.configItems.length === 0 && (
          <div className="text-[10px] text-[#64748B]">无配置项</div>
        )}
      </div>
    </div>
  );
}

function ClientTimelineItem({ snapshot }: { snapshot: ClientStateSnapshot }) {
  const onlineClients = snapshot.clients.filter((c) => c.online);
  const offlineClients = snapshot.clients.filter((c) => !c.online);

  return (
    <div className="rounded-lg px-3 py-2 bg-cyan-500/5 border border-cyan-500/20">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Server className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] text-[#64748B] font-mono">
          {formatPreciseTime(snapshot.capturedAt)}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400">
          {contextInfoTypeLabel('clientState')}
        </span>
        <span className="text-[10px] text-cyan-400">{onlineClients.length} 在线</span>
        <span className="text-[10px] text-amber-400">{offlineClients.length} 离线</span>
      </div>
      <div className="space-y-0.5">
        {snapshot.clients.map((client) => (
          <div
            key={client.id}
            className="flex items-center justify-between text-[10px] bg-[#0F172A]/50 rounded px-2 py-1"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${client.online ? 'bg-emerald-400' : 'bg-slate-500'}`}
              />
              <span className="text-[#94A3B8]">{client.name}</span>
            </div>
            <span className="text-[#64748B]">{client.ip}</span>
          </div>
        ))}
        {snapshot.clients.length === 0 && (
          <div className="text-[10px] text-[#64748B]">无注册客户端</div>
        )}
      </div>
    </div>
  );
}
