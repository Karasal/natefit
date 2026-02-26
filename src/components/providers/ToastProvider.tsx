'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'text-neon',
  error: 'text-danger',
  info: 'text-electric',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="glass flex items-center gap-3 rounded-lg px-4 py-3 min-w-[300px] max-w-[420px]"
              >
                <Icon className={`h-5 w-5 shrink-0 ${colors[t.type]}`} />
                <span className="text-sm text-text flex-1">{t.message}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-text-dim hover:text-text shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
