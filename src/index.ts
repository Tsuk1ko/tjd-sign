import { readCache, writeCache, type SessionCache } from './utils/cache.ts';
import { ApiClient } from './utils/client.ts';
import { readEnv } from './utils/env.ts';
import { hasMarkedError } from './utils/error-state.ts';
import { resolveFingerprint } from './utils/fingerprint.ts';
import { passwordLogin } from './utils/login.ts';
import { runSignIn } from './utils/signin.ts';

const env = readEnv();
let session = await readCache(env.account);

const loginAndCache = async (): Promise<SessionCache> => {
  console.log(session ? 'Token 已失效，重新登录' : '开始登录');

  const nextSession = await passwordLogin(env.account, env.password, resolveFingerprint(session));
  await writeCache(env.account, nextSession);
  session = nextSession;

  return nextSession;
};

if (!session) {
  session = await loginAndCache();
}

const client = new ApiClient(session, loginAndCache);
await runSignIn(client);
await writeCache(env.account, client.session);

if (hasMarkedError()) {
  process.exitCode = 1;
}
