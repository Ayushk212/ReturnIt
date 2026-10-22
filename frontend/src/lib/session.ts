import type { AuthUser } from './types';

// Shared, non-React handle so the API layer can read the signed-in user and a fresh token.
export const session: {
  user: AuthUser | null;
  /** Returns the current API token. `forceRefresh` bypasses any cached token. */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
} = {
  user: null,
  getToken: async () => null,
};
