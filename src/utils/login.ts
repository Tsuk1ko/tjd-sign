import { APP_ID, BID, CHANNEL_ID, SDK_VERSION, APP_VERSION } from '../const.ts';
import type { SessionCache } from './cache.ts';
import { formBody, bbsLoginClient, laohuClient, readJson } from './http.ts';
import { laohuEncrypt, laohuSign, makeDs } from './crypto.ts';
import type { Fingerprint } from './fingerprint.ts';

interface LaohuLoginResult {
  token: string;
  userId: string | number;
  nickname?: string;
}

interface BbsLoginResult {
  accessToken: string;
  uid?: string | number;
}

const baseParams = (fingerprint: Fingerprint): Record<string, string> => ({
  adid: fingerprint.deviceid,
  adm: '',
  appId: APP_ID,
  bid: BID,
  channelId: CHANNEL_ID,
  deviceId: fingerprint.deviceid,
  iOSAppOnMac: '0',
  mac: fingerprint.deviceid,
  openudid: fingerprint.openudid,
  osType: '1',
  sdkVersion: SDK_VERSION,
  t: String(Date.now()),
  vendorid: fingerprint.vendorid,
  version: APP_VERSION,
});

export const passwordLogin = async (
  account: string,
  password: string,
  fingerprint: Fingerprint,
): Promise<SessionCache> => {
  const params = {
    ...baseParams(fingerprint),
    deviceModel: 'iPhone',
    deviceName: 'iPhone',
    deviceSys: '26.1',
    deviceType: 'iPhone17,2',
    idfa: '00000000-0000-0000-0000-000000000000',
    username: laohuEncrypt(account),
    password: laohuEncrypt(password),
  };

  const signed = { ...params, sign: laohuSign(params) };
  const laohuResponse = await readJson<LaohuLoginResult>(
    await laohuClient.post('openApi/secureLogin', { body: formBody(signed) }),
  );

  if (laohuResponse.code !== 0 || !laohuResponse.result?.token) {
    throw new Error(
      `Laohu login failed: ${laohuResponse.message || JSON.stringify(laohuResponse)}`,
    );
  }

  const bbsResponse = await readJson<BbsLoginResult>(
    await bbsLoginClient.post('usercenter/api/login', {
      headers: {
        Authorization: '',
        deviceid: fingerprint.deviceid,
        ds: makeDs(),
      },
      body: formBody({
        token: laohuResponse.result.token,
        userIdentity: laohuResponse.result.userId,
        appId: APP_ID,
      }),
    }),
  );

  if (!bbsResponse.ok || !bbsResponse.data?.accessToken) {
    throw new Error(`BBS login failed: ${bbsResponse.msg || JSON.stringify(bbsResponse)}`);
  }

  return {
    ...fingerprint,
    token: bbsResponse.data.accessToken,
    uid: String(bbsResponse.data.uid ?? '0'),
    updatedAt: new Date().toISOString(),
  };
};
