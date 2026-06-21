import { Router } from 'express';
import { logService } from '../services/LogService.js';
import { logContextService } from '../services/LogContextService.js';
import type { LogContextConfig, ContextInfoType } from '../../shared/types.js';
import { ALL_CONTEXT_INFO_TYPES } from '../../shared/types.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { type, project, from, to, limit, offset } = req.query;
    const result = await logService.getLogs({
      type: type as string | undefined,
      project: project as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const count = req.query.count ? parseInt(req.query.count as string) : 10;
    const logs = await logService.getRecentLogs(count);
    res.json({ success: true, data: logs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch recent logs' });
  }
});

router.get('/contexts/config', async (req, res) => {
  try {
    const config = await logContextService.getConfig();
    const stats = await logContextService.getStats();
    res.json({ success: true, data: { config, stats, availableInfoTypes: ALL_CONTEXT_INFO_TYPES } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch context config' });
  }
});

router.put('/contexts/config', async (req, res) => {
  try {
    const { enabled, timeWindowBefore, timeWindowAfter, infoTypes, retentionDays } = req.body;
    const updates: Partial<LogContextConfig> = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof timeWindowBefore === 'number' && timeWindowBefore >= 0) updates.timeWindowBefore = timeWindowBefore;
    if (typeof timeWindowAfter === 'number' && timeWindowAfter >= 0) updates.timeWindowAfter = timeWindowAfter;
    if (Array.isArray(infoTypes)) {
      updates.infoTypes = infoTypes.filter((t: ContextInfoType) => ALL_CONTEXT_INFO_TYPES.includes(t));
    }
    if (typeof retentionDays === 'number' && retentionDays > 0) updates.retentionDays = retentionDays;
    const config = await logContextService.updateConfig(updates);
    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update context config' });
  }
});

router.get('/contexts/stats', async (req, res) => {
  try {
    const stats = await logContextService.getStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch context stats' });
  }
});

router.post('/contexts/cleanup', async (req, res) => {
  try {
    const removed = await logContextService.cleanupExpired();
    res.json({ success: true, data: { removed } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to cleanup expired contexts' });
  }
});

router.get('/contexts/:errorLogId', async (req, res) => {
  try {
    const context = await logContextService.getContextByErrorLogId(req.params.errorLogId);
    if (!context) {
      res.status(404).json({ success: false, error: 'Context not found or expired' });
      return;
    }
    res.json({ success: true, data: context });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch context' });
  }
});

export default router;
