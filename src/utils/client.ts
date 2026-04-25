import type { KyInstance, Options } from 'ky';

import { TOKEN_EXPIRED_CODES } from '../const.ts';
import type { SessionCache } from './cache.ts';
import {
  createH5Client,
  createNativeClient,
  formBody,
  readJson,
  type ApiResponse,
} from './http.ts';

export type Relogin = () => Promise<SessionCache>;

export class ApiClient {
  private currentSession: SessionCache;
  private nativeClient: KyInstance;
  private h5Client: KyInstance;
  private relogin: Relogin;

  constructor(session: SessionCache, relogin: Relogin) {
    this.currentSession = session;
    this.nativeClient = createNativeClient(session);
    this.h5Client = createH5Client(session);
    this.relogin = relogin;
  }

  get session(): SessionCache {
    return this.currentSession;
  }

  updateSession(session: SessionCache): void {
    this.currentSession = session;
    this.nativeClient = createNativeClient(session);
    this.h5Client = createH5Client(session);
  }

  nativeGet<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('native', 'get', path, { searchParams: query });
  }

  nativePost<T>(path: string, body?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('native', 'post', path, {
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: body ? formBody(body) : undefined,
    });
  }

  h5Get<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('h5', 'get', path, { searchParams: query });
  }

  h5Post<T>(path: string, body?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('h5', 'post', path, {
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: body ? formBody(body) : undefined,
    });
  }

  private async request<T>(
    kind: 'native' | 'h5',
    method: 'get' | 'post',
    path: string,
    options: Options = {},
    retry = true,
  ): Promise<T> {
    const client = kind === 'native' ? this.nativeClient : this.h5Client;
    const response = await client[method](path, options);
    const payload = await readJson<T>(response);

    if (retry && isTokenExpired(response.status, payload)) {
      const session = await this.relogin();
      this.updateSession(session);
      return this.request<T>(kind, method, path, options, false);
    }

    if (!isOk(response.status, payload)) {
      throw new Error(payload.msg || payload.message || `Request failed: HTTP ${response.status}`);
    }

    return payload.data as T;
  }
}

const isTokenExpired = (status: number, payload: ApiResponse<unknown>): boolean =>
  TOKEN_EXPIRED_CODES.has(status) || TOKEN_EXPIRED_CODES.has(Number(payload.code));

const isOk = (status: number, payload: ApiResponse<unknown>): boolean =>
  status >= 200 && status < 300 && payload.ok === true && payload.code === 0;
