import { createCipheriv } from 'node:crypto';

import { AES_KEY, APP_VERSION, BBS_SECRET, LAOHU_SECRET } from '../const.ts';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const md5 = (value: string): string =>
  new Bun.CryptoHasher('md5').update(value).digest('hex');

export const laohuSign = (params: Record<string, string>): string => {
  const values = Object.keys(params)
    .sort()
    .map(key => params[key] ?? '')
    .join('');

  return md5(`${values}${LAOHU_SECRET}`);
};

export const makeDs = (): string => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = Array.from(
    { length: 8 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join('');
  const signature = md5(`${timestamp}${nonce}${APP_VERSION}${BBS_SECRET}`);

  return `${timestamp},${nonce},${signature}`;
};

export const laohuEncrypt = (plaintext: string): string => {
  const cipher = createCipheriv('aes-128-ecb', Buffer.from(AES_KEY), null);
  cipher.setAutoPadding(true);

  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64');
};
