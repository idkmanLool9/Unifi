import { create } from 'zustand';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

const AUTO_DISMISS_MS = 3800;
const MAX_VISIBLE = 4;

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  push: (toast) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }));
    setTimeout(() => {
      useToastStore.getState().dismiss(id);
    }, AUTO_DISMISS_MS);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for pushing toasts from non-React code. */
export const toast = (t: Omit<Toast, 'id'>) => useToastStore.getState().push(t);
