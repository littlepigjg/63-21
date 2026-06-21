import { logRepository } from '../repositories/LogRepository.js';
import { logContextService } from './LogContextService.js';
import crypto from 'crypto';
import type { LogEntry, LogType } from '../../shared/types.js';

export class LogService {
  async addLog(type: LogType, clientIp: string, clientName: string, project: string, environment: string, detail: string): Promise<LogEntry> {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      clientIp,
      clientName,
      project,
      environment,
      detail,
    };
    const result = await logRepository.addLog(entry);

    if (type === 'error') {
      logContextService.generateContext(result).catch(() => {});
    }

    return result;
  }

  async addErrorLog(clientIp: string, clientName: string, project: string, environment: string, detail: string): Promise<LogEntry> {
    return this.addLog('error', clientIp, clientName, project, environment, detail);
  }

  async getLogs(filters?: { type?: string; project?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    return logRepository.getLogs(filters);
  }

  async getRecentLogs(count: number = 10) {
    return logRepository.getRecentLogs(count);
  }
}

export const logService = new LogService();
