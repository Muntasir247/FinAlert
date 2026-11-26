import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import {
  fetchUserFamily,
  createFamily as createFamilyDb,
  joinFamilyByCode as joinFamilyByCodeDb,
  leaveFamily as leaveFamilyDb,
  deleteFamily as deleteFamilyDb,
  subscribeToFamilyChanges,
  subscribeToUserMembership,
} from '../lib/families';
import type { Family, FamilyMember } from '../lib/families';

interface FamilyContextType {
  family: Family | null;
  members: FamilyMember[];
  isLoading: boolean;
  hasLoaded: boolean;
  createFamily: (name: string) => Promise<{ error: any; family?: Family }>;
  joinFamily: (code: string) => Promise<{ error: any; family?: Family }>;
  leaveFamily: () => Promise<{ error: any }>;
  deleteFamily: () => Promise<{ error: any }>;
  refreshFamily: (silent?: boolean) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

function mapFamilyError(err: any): string {
  const msg = err?.message ?? '';
  if (msg.includes('ALREADY_IN_FAMILY')) {
    return "You're already part of a family group.";
  }
  if (msg.includes('INVALID_CODE')) {
    return 'Invalid family code. Please check and try again.';
  }
  if (msg.includes('SOLE_ADMIN_CANNOT_LEAVE')) {
    return 'Please promote another member to Admin before leaving, or delete the family.';
  }
  if (msg.includes('NOT_ADMIN')) {
    return 'Only an admin can perform this action.';
  }
  if (msg.includes('Family name is required')) {
    return 'Please enter a name for your family.';
  }
  return err?.message || 'Something went wrong. Please try again.';
}

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadFamily = useCallback(async (userId: string, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const result = await fetchUserFamily(userId);
      setFamily(result?.family ?? null);
      setMembers(result?.members ?? []);
      setHasLoaded(true);
    } catch (e) {
      console.error('Failed to load family:', e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const refreshFamily = useCallback(
    async (silent = false) => {
      if (!user) {
        setFamily(null);
        setMembers([]);
        setIsLoading(false);
        setHasLoaded(false);
        return;
      }
      await loadFamily(user.id, silent);
    },
    [user, loadFamily]
  );

  // Initial load when user changes
  useEffect(() => {
    if (user) {
      loadFamily(user.id);
    } else {
      setFamily(null);
      setMembers([]);
      setIsLoading(false);
      setHasLoaded(false);
    }
  }, [user, loadFamily]);

  // ── Realtime: User Membership Subscription ────────────────────────────────
  // Listens for when the current user joins, is added to, or is removed from any family
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserMembership(user.id, () => {
      loadFamily(user.id, true);
    });

    return () => {
      unsubscribe();
    };
  }, [user, loadFamily]);

  // ── Realtime: Active Family Roster Subscription ───────────────────────────
  // Listens for other members joining, leaving, updating roles, or the family being deleted
  useEffect(() => {
    if (!user || !family?.id) return;

    const unsubscribe = subscribeToFamilyChanges(family.id, () => {
      loadFamily(user.id, true);
    });

    return () => {
      unsubscribe();
    };
  }, [user, family?.id, loadFamily]);

  // ── AppState Listener: Resuming from Background ───────────────────────────
  // Instantly re-syncs family roster whenever user brings app back to foreground
  useEffect(() => {
    if (!user) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        loadFamily(user.id, true);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [user, loadFamily]);

  const createFamily = useCallback(
    async (name: string): Promise<{ error: any; family?: Family }> => {
      if (!user) {
        return { error: { message: 'You must be signed in.' } };
      }
      try {
        const fam = await createFamilyDb(name);
        await loadFamily(user.id);
        notify({
          category: 'family',
          title: 'Family group created',
          message: `You created ${fam.name}. Share code ${fam.invite_code} to invite members.`,
          progress: null,
          accent_color: 'blue',
          action_type: 'view_family',
        });
        return { error: null, family: fam };
      } catch (error) {
        console.error('Error creating family:', error);
        return { error: { message: mapFamilyError(error) } };
      }
    },
    [user, loadFamily, notify]
  );

  const joinFamily = useCallback(
    async (code: string): Promise<{ error: any; family?: Family }> => {
      if (!user) {
        return { error: { message: 'You must be signed in.' } };
      }
      try {
        const fam = await joinFamilyByCodeDb(code);
        await loadFamily(user.id);
        notify({
          category: 'family',
          title: 'You joined a family',
          message: `You joined ${fam.name}.`,
          progress: null,
          accent_color: 'blue',
          action_type: 'view_family',
        });
        return { error: null, family: fam };
      } catch (error) {
        console.error('Error joining family:', error);
        return { error: { message: mapFamilyError(error) } };
      }
    },
    [user, loadFamily, notify]
  );

  const leaveFamily = useCallback(async () => {
    try {
      await leaveFamilyDb();
      setFamily(null);
      setMembers([]);
      notify({
        category: 'family',
        title: 'Left family group',
        message: 'You have left the family group.',
        progress: null,
        accent_color: 'blue',
        action_type: 'view_family',
      });
      return { error: null };
    } catch (error) {
      console.error('Error leaving family:', error);
      return { error: { message: mapFamilyError(error) } };
    }
  }, [notify]);

  const deleteFamily = useCallback(async () => {
    if (!family) {
      return { error: { message: 'No active family' } };
    }
    try {
      await deleteFamilyDb(family.id);
      setFamily(null);
      setMembers([]);
      notify({
        category: 'family',
        title: 'Family group deleted',
        message: `${family.name} was deleted.`,
        progress: null,
        accent_color: 'blue',
        action_type: 'view_family',
      });
      return { error: null };
    } catch (error) {
      console.error('Error deleting family:', error);
      return { error: { message: mapFamilyError(error) } };
    }
  }, [family, notify]);

  return (
    <FamilyContext.Provider
      value={{
        family,
        members,
        isLoading,
        hasLoaded,
        createFamily,
        joinFamily,
        leaveFamily,
        deleteFamily,
        refreshFamily,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};
