import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

type Toast = { id: number; message: string; type: ToastType };

let _listeners: Array<(toasts: Toast[]) => void> = [];
let _toasts: Toast[] = [];
let _nextId = 0;

function _notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

export function showToast(message: string, type: ToastType = "success", duration = 3000) {
  const id = _nextId++;
  _toasts = [..._toasts, { id, message, type }];
  _notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _notify();
  }, duration);
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    _listeners.push(setToasts);
    return () => {
      _listeners = _listeners.filter((l) => l !== setToasts);
    };
  }, []);
  return toasts;
}
