import type { AuthUser } from './types';

// Shared, non-React handle so the API layer can read the signed-in user and token.
export const session: { user: AuthUser | null; getToken: () => Promise<string | null> } = {
  user: null,
  getToken: async () => null,
};
