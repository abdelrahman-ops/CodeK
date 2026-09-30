import fs from 'fs/promises';
import path from 'path';
import { createAuditLog } from '../audit/audit.service.js';

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'data/security-settings.json');

export interface SystemSecuritySettings {
  watermarkEnabled: boolean;
  antiScreenshotEnabled: boolean;
  watermarkOpacity: number;
  updatedAt: string;
}

const DEFAULT_SETTINGS: SystemSecuritySettings = {
  watermarkEnabled: true,
  antiScreenshotEnabled: true,
  watermarkOpacity: 15,
  updatedAt: new Date().toISOString()
};

let inMemoryCache: SystemSecuritySettings | null = null;

async function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function getSecuritySettings(): Promise<SystemSecuritySettings> {
  if (inMemoryCache) {
    return inMemoryCache;
  }

  try {
    const raw = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryCache = {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
    return inMemoryCache!;
  } catch {
    inMemoryCache = { ...DEFAULT_SETTINGS };
    try {
      await ensureDirectoryExists(SETTINGS_FILE_PATH);
      await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(inMemoryCache, null, 2), 'utf-8');
    } catch {}
    return inMemoryCache!;
  }
}

export async function updateSecuritySettings(
  input: Partial<Pick<SystemSecuritySettings, 'watermarkEnabled' | 'antiScreenshotEnabled' | 'watermarkOpacity'>>,
  actorUserId?: string
): Promise<SystemSecuritySettings> {
  const current = await getSecuritySettings();
  const updated: SystemSecuritySettings = {
    ...current,
    ...(input.watermarkEnabled !== undefined ? { watermarkEnabled: input.watermarkEnabled } : {}),
    ...(input.antiScreenshotEnabled !== undefined ? { antiScreenshotEnabled: input.antiScreenshotEnabled } : {}),
    ...(input.watermarkOpacity !== undefined ? { watermarkOpacity: Math.min(100, Math.max(5, input.watermarkOpacity)) } : {}),
    updatedAt: new Date().toISOString()
  };

  inMemoryCache = updated;

  try {
    await ensureDirectoryExists(SETTINGS_FILE_PATH);
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write security-settings.json:', err);
  }

  await createAuditLog({
    actorUserId,
    action: 'SECURITY_SETTINGS_UPDATED',
    entityType: 'SystemSettings',
    metadata: { changed: input, current: updated }
  });

  return updated;
}
