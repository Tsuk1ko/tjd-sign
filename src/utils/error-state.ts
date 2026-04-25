let hasError = false;

export const markError = (): void => {
  hasError = true;
};

export const hasMarkedError = (): boolean => hasError;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
