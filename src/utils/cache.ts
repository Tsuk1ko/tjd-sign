import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { CACHE_DIR } from '../const.ts';
import { md5 } from './crypto.ts';
import type { Fingerprint } from './fingerprint.ts';

export interface SessionCache extends Fingerprint {
  token: string;
  uid: string;
  accountUid?: string;
  updatedAt: string;
}

export const cachePathForAccount = (account: string): string =>
  join(CACHE_DIR, `${md5(account)}.json`);

export const readCache = async (account: string): Promise<SessionCache | null> => {
  const path = cachePathForAccount(account);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  try {
    const parsed = (await file.json()) as Partial<SessionCache>;

    if (!parsed.token || !parsed.deviceid || !parsed.openudid || !parsed.vendorid) {
      return null;
    }

    return {
      token: parsed.token,
      deviceid: parsed.deviceid,
      openudid: parsed.openudid,
      vendorid: parsed.vendorid,
      uid: parsed.uid || '0',
      accountUid: parsed.accountUid,
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
};

export const writeCache = async (
  account: string,
  cache: Omit<SessionCache, 'updatedAt'>,
): Promise<void> => {
  await mkdir(CACHE_DIR, { recursive: true });
  await Bun.write(
    cachePathForAccount(account),
    `${JSON.stringify({ ...cache, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  );
};
