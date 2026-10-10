'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { studioStorage } from './studio-storage.js';
import { USER_STORE_KEY } from './storage-keys.js';

export interface UserState {
  username: string | null;
  signInPromptOpen: boolean;
  setUsername: (name: string) => void;
  reset: () => void;
  openSignInPrompt: () => void;
  closeSignInPrompt: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      username: null,
      signInPromptOpen: false,
      setUsername: (name) => set({ username: name, signInPromptOpen: false }),
      reset: () => set({ username: null, signInPromptOpen: false }),
      openSignInPrompt: () => set({ signInPromptOpen: true }),
      closeSignInPrompt: () => set({ signInPromptOpen: false }),
    }),
    {
      name: USER_STORE_KEY,
      storage: createJSONStorage(() => studioStorage),
      partialize: (state) => ({ username: state.username }),
    },
  ),
);

export function useUserHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useUserStore.persist.onFinishHydration(onChange),
    () => useUserStore.persist.hasHydrated(),
    () => false,
  );
}
