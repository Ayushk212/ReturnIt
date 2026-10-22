import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Item } from '../lib/types';

/**
 * Optimistic bookmark toggling for a list of items. Signed-out users are sent to sign in
 * and returned here afterwards; failed requests roll the optimistic change back.
 */
export function useSaveToggle(data: Item[] | null) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [savedOverride, setSavedOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSavedOverride({});
  }, [data]);

  const items = (data ?? []).map((i) => ({ ...i, saved: savedOverride[i.id] ?? i.saved }));

  async function toggleSave(item: Item) {
    if (!user) {
      navigate('/signin', { state: { from: loc.pathname + loc.search } });
      return;
    }
    const next = !item.saved;
    setSavedOverride((s) => ({ ...s, [item.id]: next }));
    try {
      await api.toggleSave(item.id);
    } catch {
      setSavedOverride((s) => ({ ...s, [item.id]: !next }));
    }
  }

  return { items, toggleSave };
}
