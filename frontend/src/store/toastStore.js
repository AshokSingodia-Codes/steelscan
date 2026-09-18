import { create } from 'zustand'

let nextId = 1

export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = nextId++
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }))
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
    return id
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const toast = {
  success: (msg) => useToastStore.getState().addToast('success', msg),
  error: (msg) => useToastStore.getState().addToast('error', msg, 6000),
  info: (msg) => useToastStore.getState().addToast('info', msg),
  warn: (msg) => useToastStore.getState().addToast('warn', msg),
}
