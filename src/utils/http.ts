import ky, { type KyInstance } from 'ky';

import { APP_VERSION, BBS_HOST, BBS_UA, H5_ORIGIN, H5_UA, LAOHU_HOST, LAOHU_UA } from '../const.ts';
import { makeDs } from './crypto.ts';
import type { SessionCache } from './cache.ts';

export interface ApiResponse<T> {
  ok?: boolean;
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
  result?: T;
}

export const formBody = (body: Record<string, string | number | boolean>): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    params.set(key, String(value));
  }

  return params;
};

const base = ky.create({
  timeout: 15_000,
  retry: { limit: 0 },
  throwHttpErrors: false,
});

export const laohuClient = base.extend({
  prefix: LAOHU_HOST,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': LAOHU_UA,
  },
});

export const bbsLoginClient = base.extend({
  prefix: BBS_HOST,
  headers: {
    Accept: 'application/json, text/plain, */*',
    appversion: APP_VERSION,
    platform: 'ios',
    uid: '0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': BBS_UA,
  },
});

export const createNativeClient = (session: SessionCache): KyInstance =>
  base.extend({
    prefix: BBS_HOST,
    hooks: {
      beforeRequest: [
        ({ request }) => {
          request.headers.set('Accept', 'application/json, text/plain, */*');
          request.headers.set('Authorization', session.token);
          request.headers.set('appversion', APP_VERSION);
          request.headers.set('platform', 'ios');
          request.headers.set('uid', session.uid);
          request.headers.set('deviceid', session.deviceid);
          request.headers.set('ds', makeDs());
          request.headers.set('User-Agent', BBS_UA);
        },
      ],
    },
  });

export const createH5Client = (session: SessionCache): KyInstance =>
  base.extend({
    prefix: BBS_HOST,
    hooks: {
      beforeRequest: [
        ({ request }) => {
          request.headers.set('Accept', 'application/json, text/plain, */*');
          request.headers.set('Authorization', session.token);
          request.headers.set('Origin', H5_ORIGIN);
          request.headers.set('Referer', `${H5_ORIGIN}/`);
          request.headers.set('User-Agent', H5_UA);
        },
      ],
    },
  });

export const readJson = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(`Unexpected non-JSON response: ${text.slice(0, 200)}`);
  }
};
