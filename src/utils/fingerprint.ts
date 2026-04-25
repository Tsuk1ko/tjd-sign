export interface Fingerprint {
  deviceid: string;
  openudid: string;
  vendorid: string;
}

const randomHex = (bytes: number): string => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);

  return Array.from(data, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

export const createFingerprint = (): Fingerprint => ({
  deviceid: randomHex(16),
  openudid: crypto.randomUUID().toUpperCase(),
  vendorid: crypto.randomUUID().toUpperCase(),
});

export const resolveFingerprint = (cached?: Partial<Fingerprint> | null): Fingerprint => {
  const generated = createFingerprint();

  return {
    deviceid: cached?.deviceid || generated.deviceid,
    openudid: cached?.openudid || generated.openudid,
    vendorid: cached?.vendorid || generated.vendorid,
  };
};
