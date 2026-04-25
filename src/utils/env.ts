export interface EnvConfig {
  account: string;
  password: string;
}

export const readEnv = (): EnvConfig => {
  const account = process.env.TJD_ACCOUNT?.trim();
  const password = process.env.TJD_PASSWORD;

  if (!account || !password) {
    throw new Error('TJD_ACCOUNT and TJD_PASSWORD are required');
  }

  return { account, password };
};
