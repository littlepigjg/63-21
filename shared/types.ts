export interface ConfigItem {
  key: string;
  value: string;
  description: string;
  encrypted: boolean;
  iv?: string;
  tag?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Environment {
  name: string;
  configs: ConfigItem[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  environments: Environment[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'pull' | 'change' | 'encrypt' | 'decrypt' | 'client_register' | 'notify' | 'error';
  clientIp: string;
  clientName: string;
  project: string;
  environment: string;
  detail: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  ip: string;
  token: string;
  lastHeartbeat: string;
  online: boolean;
}

export interface ConfigData {
  encryptionKey: string;
  projects: Project[];
}

export interface LogsData {
  logs: LogEntry[];
}

export interface ClientsData {
  clients: ClientInfo[];
}

export interface PullResponse {
  configs: Record<string, string>;
  version: string;
  pulledAt: string;
}

export type LogType = LogEntry['type'];

export type ContextInfoType = 'relatedLogs' | 'configSnapshot' | 'clientState';

export interface LogContextConfig {
  enabled: boolean;
  timeWindowBefore: number;
  timeWindowAfter: number;
  infoTypes: ContextInfoType[];
  retentionDays: number;
}

export interface ConfigSnapshotItem {
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: string;
}

export interface ConfigSnapshot {
  projectId: string;
  projectName: string;
  environment: string;
  configItems: ConfigSnapshotItem[];
  capturedAt: string;
}

export interface ClientStateItem {
  id: string;
  name: string;
  ip: string;
  online: boolean;
  lastHeartbeat: string;
}

export interface ClientStateSnapshot {
  clients: ClientStateItem[];
  capturedAt: string;
}

export interface LogContext {
  id: string;
  errorLogId: string;
  errorTimestamp: string;
  generatedAt: string;
  expiresAt: string;
  relatedLogs: LogEntry[];
  configSnapshots: ConfigSnapshot[];
  clientState: ClientStateSnapshot | null;
  config: LogContextConfig;
}

export interface LogContextData {
  config: LogContextConfig;
  contexts: LogContext[];
  index: Record<string, string>;
}

export const DEFAULT_LOG_CONTEXT_CONFIG: LogContextConfig = {
  enabled: true,
  timeWindowBefore: 5 * 60 * 1000,
  timeWindowAfter: 5 * 60 * 1000,
  infoTypes: ['relatedLogs', 'configSnapshot', 'clientState'],
  retentionDays: 7,
};

export const ALL_CONTEXT_INFO_TYPES: ContextInfoType[] = ['relatedLogs', 'configSnapshot', 'clientState'];
