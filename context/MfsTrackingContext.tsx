import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  type MfsProvider,
  ALL_MFS_PROVIDERS,
  loadTrackedProviders,
  isTrackedProvidersConfigured,
  setTrackedProviders as persistTrackedProviders,
  syncRecentSms,
} from '../services/smsReaderService';
import MfsProviderModal from '../components/MfsProviderModal';

interface MfsTrackingContextType {
  trackedProviders: MfsProvider[];
  isConfigured: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  saveProviders: (providers: MfsProvider[]) => Promise<void>;
  isProviderTracked: (provider: MfsProvider) => boolean;
}

const MfsTrackingContext = createContext<MfsTrackingContextType | undefined>(undefined);

export const MfsTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading: isAuthLoading } = useAuth();
  const [trackedProviders, setTrackedProvidersState] = useState<MfsProvider[]>(ALL_MFS_PROVIDERS);
  const [isConfigured, setIsConfigured] = useState<boolean>(true); // Start optimistic
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const [configured, saved] = await Promise.all([
        isTrackedProvidersConfigured(),
        loadTrackedProviders(),
      ]);
      if (!isMounted) return;
      setTrackedProvidersState(saved);
      setIsConfigured(configured);
      setHasCheckedStorage(true);

      // If user has not configured and is currently logged in, prompt them
      if (!configured && session) {
        setIsModalOpen(true);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [session]);

  // When auth state settles and user is logged in, check if prompt needed
  useEffect(() => {
    if (hasCheckedStorage && !isConfigured && session && !isAuthLoading) {
      setIsModalOpen(true);
    }
  }, [hasCheckedStorage, isConfigured, session, isAuthLoading]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const saveProviders = useCallback(async (newProviders: MfsProvider[]) => {
    setTrackedProvidersState(newProviders);
    setIsConfigured(true);
    setIsModalOpen(false);
    await persistTrackedProviders(newProviders);
    syncRecentSms();
  }, []);

  const isProviderTracked = useCallback(
    (provider: MfsProvider) => trackedProviders.includes(provider),
    [trackedProviders]
  );

  const value = useMemo(
    () => ({
      trackedProviders,
      isConfigured,
      isModalOpen,
      openModal,
      closeModal,
      saveProviders,
      isProviderTracked,
    }),
    [
      trackedProviders,
      isConfigured,
      isModalOpen,
      openModal,
      closeModal,
      saveProviders,
      isProviderTracked,
    ]
  );

  return (
    <MfsTrackingContext.Provider value={value}>
      {children}
      <MfsProviderModal
        visible={isModalOpen}
        onClose={closeModal}
        onSave={saveProviders}
        selectedProviders={trackedProviders}
      />
    </MfsTrackingContext.Provider>
  );
};

export function useMfsTracking() {
  const context = useContext(MfsTrackingContext);
  if (!context) {
    throw new Error('useMfsTracking must be used within an MfsTrackingProvider');
  }
  return context;
}
