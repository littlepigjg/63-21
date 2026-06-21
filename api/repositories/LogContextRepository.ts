import { JsonRepository } from './JsonRepository.js';
import type { LogContextData, LogContext, LogContextConfig } from '../../shared/types.js';
import { DEFAULT_LOG_CONTEXT_CONFIG } from '../../shared/types.js';

export class LogContextRepository {
  private repo: JsonRepository<LogContextData>;

  constructor() {
    this.repo = new JsonRepository<LogContextData>('log_contexts.json', {
      config: DEFAULT_LOG_CONTEXT_CONFIG,
      contexts: [],
      index: {},
    });
  }

  async getData(): Promise<LogContextData> {
    const data = await this.repo.read();
    if (!data.config) {
      data.config = DEFAULT_LOG_CONTEXT_CONFIG;
    }
    if (!data.contexts) {
      data.contexts = [];
    }
    if (!data.index) {
      data.index = {};
    }
    return data;
  }

  async getConfig(): Promise<LogContextConfig> {
    const data = await this.getData();
    return data.config;
  }

  async saveConfig(config: LogContextConfig): Promise<void> {
    const data = await this.getData();
    data.config = config;
    await this.repo.write(data);
  }

  async addContext(context: LogContext): Promise<LogContext> {
    const data = await this.getData();
    const existingId = data.index[context.errorLogId];
    if (existingId) {
      data.contexts = data.contexts.filter((c) => c.id !== existingId);
    }
    data.contexts.push(context);
    data.index[context.errorLogId] = context.id;
    await this.repo.write(data);
    return context;
  }

  async getContextByErrorLogId(errorLogId: string): Promise<LogContext | null> {
    const data = await this.getData();
    const contextId = data.index[errorLogId];
    if (!contextId) return null;
    return data.contexts.find((c) => c.id === contextId) ?? null;
  }

  async getContextById(id: string): Promise<LogContext | null> {
    const data = await this.getData();
    return data.contexts.find((c) => c.id === id) ?? null;
  }

  async cleanupExpired(): Promise<number> {
    const data = await this.getData();
    const now = Date.now();
    const before = data.contexts.length;
    const expired = data.contexts.filter((c) => new Date(c.expiresAt).getTime() < now);
    for (const ctx of expired) {
      delete data.index[ctx.errorLogId];
    }
    data.contexts = data.contexts.filter((c) => new Date(c.expiresAt).getTime() >= now);
    if (before !== data.contexts.length) {
      await this.repo.write(data);
    }
    return before - data.contexts.length;
  }

  async getStats(): Promise<{ total: number; expired: number }> {
    const data = await this.getData();
    const now = Date.now();
    const expired = data.contexts.filter((c) => new Date(c.expiresAt).getTime() < now).length;
    return { total: data.contexts.length, expired };
  }
}

export const logContextRepository = new LogContextRepository();
