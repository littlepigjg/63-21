import { logContextRepository } from '../repositories/LogContextRepository.js';
import { logRepository } from '../repositories/LogRepository.js';
import { configRepository } from '../repositories/ConfigRepository.js';
import { clientRepository } from '../repositories/ClientRepository.js';
import crypto from 'crypto';
import type {
  LogContext,
  LogContextConfig,
  LogEntry,
  ConfigSnapshot,
  ClientStateSnapshot,
} from '../../shared/types.js';
import { DEFAULT_LOG_CONTEXT_CONFIG } from '../../shared/types.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLIENT_HEARTBEBEAT_TIMEOUT_MS = 60000;

export class LogContextService {
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  async getConfig(): Promise<LogContextConfig> {
    const config = await logContextRepository.getConfig();
    return { ...DEFAULT_LOG_CONTEXT_CONFIG, ...config };
  }

  async updateConfig(updates: Partial<LogContextConfig>): Promise<LogContextConfig> {
    const current = await this.getConfig();
    const merged: LogContextConfig = {
      ...current,
      ...updates,
      infoTypes: updates.infoTypes ?? current.infoTypes,
    };
    await logContextRepository.saveConfig(merged);
    this.startCleanupScheduler();
    return merged;
  }

  async generateContext(errorLog: LogEntry): Promise<void> {
    try {
      const config = await this.getConfig();
      if (!config.enabled) return;

      const errorTime = new Date(errorLog.timestamp).getTime();
      const fromTime = new Date(errorTime - config.timeWindowBefore).toISOString();
      const toTime = new Date(errorTime + config.timeWindowAfter).toISOString();

      let relatedLogs: LogEntry[] = [];
      let configSnapshots: ConfigSnapshot[] = [];
      let clientState: ClientStateSnapshot | null = null;

      if (config.infoTypes.includes('relatedLogs')) {
        relatedLogs = await this.captureRelatedLogs(fromTime, toTime);
      }

      if (config.infoTypes.includes('configSnapshot') && errorLog.project) {
        configSnapshots = await this.captureConfigSnapshots(errorLog.project, errorLog.environment);
      }

      if (config.infoTypes.includes('clientState')) {
        clientState = await this.captureClientState();
      }

      const context: LogContext = {
        id: crypto.randomUUID(),
        errorLogId: errorLog.id,
        errorTimestamp: errorLog.timestamp,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + config.retentionDays * 86400000).toISOString(),
        relatedLogs,
        configSnapshots,
        clientState,
        config,
      };

      await logContextRepository.addContext(context);
    } catch {
      // Silently fail to not affect normal operation
    }
  }

  private async captureRelatedLogs(fromTime: string, toTime: string): Promise<LogEntry[]> {
    const result = await logRepository.getLogs({
      from: fromTime,
      to: toTime,
      limit: 1000,
    });
    return result.logs.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  private async captureConfigSnapshots(
    projectIdentifier: string,
    environment: string,
  ): Promise<ConfigSnapshot[]> {
    const projects = await configRepository.getAllProjects();
    const snapshots: ConfigSnapshot[] = [];
    const capturedAt = new Date().toISOString();

    for (const project of projects) {
      if (project.id === projectIdentifier || project.name === projectIdentifier) {
        for (const env of project.environments) {
          if (!environment || env.name === environment) {
            snapshots.push({
              projectId: project.id,
              projectName: project.name,
              environment: env.name,
              configItems: env.configs.map((c) => ({
                key: c.key,
                value: c.encrypted ? '[ENCRYPTED]' : c.value,
                encrypted: c.encrypted,
                updatedAt: c.updatedAt,
              })),
              capturedAt,
            });
          }
        }
      }
    }
    return snapshots;
  }

  private async captureClientState(): Promise<ClientStateSnapshot> {
    const clients = await clientRepository.getAllClients();
    const now = Date.now();
    return {
      clients: clients.map((c) => {
        const lastHeartbeat = new Date(c.lastHeartbeat).getTime();
        return {
          id: c.id,
          name: c.name,
          ip: c.ip,
          online: now - lastHeartbeat <= CLIENT_HEARTBEBEAT_TIMEOUT_MS,
          lastHeartbeat: c.lastHeartbeat,
        };
      }),
      capturedAt: new Date().toISOString(),
    };
  }

  async getContextByErrorLogId(errorLogId: string): Promise<LogContext | null> {
    return logContextRepository.getContextByErrorLogId(errorLogId);
  }

  async cleanupExpired(): Promise<number> {
    return logContextRepository.cleanupExpired();
  }

  async getStats(): Promise<{ total: number; expired: number }> {
    return logContextRepository.getStats();
  }

  startCleanupScheduler(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }
}

export const logContextService = new LogContextService();
