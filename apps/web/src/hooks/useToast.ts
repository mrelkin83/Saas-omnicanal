import { useCallback, useState, useEffect } from 'react';

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

function notify() {
  toastListeners.forEach((l) => l([...toasts]));
}

export function addToast(message: string, type: Toast['type'] = 'info', duration = 4000) {
  const id = `${Date.now()}-${Math.random()}`;
  toasts = [...toasts, { id, message, type, duration }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, duration);
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setState);
    setState([...toasts]);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setState);
    };
  }, []);

  return state;
}

export function toast(message: string, type?: Toast['type'], duration?: number) {
  addToast(message, type, duration);
}

toast.success = (message: string, duration?: number) => addToast(message, 'success', duration);
toast.error = (message: string, duration?: number) => addToast(message, 'error', duration);
toast.info = (message: string, duration?: number) => addToast(message, 'info', duration);
