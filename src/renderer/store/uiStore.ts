import { create } from 'zustand';

interface UIState {
  drawerOpen: boolean;
  isLoading: boolean;
  hasNewMessage: boolean;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setLoading: (loading: boolean) => void;
  setHasNewMessage: (hasNew: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  isLoading: false,
  hasNewMessage: false,

  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  openDrawer: () => set({ drawerOpen: true }),

  closeDrawer: () => set({ drawerOpen: false }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setHasNewMessage: (hasNew: boolean) => set({ hasNewMessage: hasNew }),
}));
