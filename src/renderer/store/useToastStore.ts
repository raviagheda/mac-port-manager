import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
}

interface ToastStoreState {
  toasts: Toast[];
  push(message: string): void;
  dismiss(id: string): void;
}

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({ toasts: [...get().toasts, { id, message }] });
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  }
}));
