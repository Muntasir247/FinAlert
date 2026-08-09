import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';
import {
  fetchUserFamily,
  createFamily as createFamilyDb,
  joinFamilyByCode as joinFamilyByCodeDb,
} from '../lib/families';
import type { Family, FamilyMember } from '../lib/families';

interface FamilyContextType {
  family: Family | null;
  members: FamilyMember[];
  isLoading: boolean;
  hasLoaded: boolean;
  createFamily: (name: string) => Promise<{ error: any; family?: Family }>;
  joinFamily: (code: string) => Promise<{ error: any; family?: Family }>;
  refreshFamily: () => Promise<void>;
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

  const loadFamily = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const result = await fetchUserFamily(userId);
      setFamily(result?.family ?? null);
      setMembers(result?.members ?? []);
      setHasLoaded(true);
    } catch (e) {
      console.error('Failed to load family:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshFamily = useCallback(async () => {
    if (!user) {
      setFamily(null);
      setMembers([]);
      setIsLoading(false);
      setHasLoaded(false);
      return;
    }
    await loadFamily(user.id);
  }, [user, loadFamily]);

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

  return (
    <FamilyContext.Provider
      value={{
        family,
        members,
        isLoading,
        hasLoaded,
        createFamily,
        joinFamily,
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
