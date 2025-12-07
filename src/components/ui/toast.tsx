import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'completed' | 'incomplete' | 'important' | 'not-important';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      // Wait for exit animation to complete before removing
      setTimeout(() => {
        onRemove(toast.id);
      }, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'completed':
        return <span className="text-green-500 text-xl">✓</span>;
      case 'incomplete':
        return <span className="text-neutral-400 text-xl">○</span>;
      case 'important':
        return <span className="text-amber-400 text-xl">★</span>;
      case 'not-important':
        return <span className="text-neutral-400 text-xl">☆</span>;
      default:
        return null;
    }
  };

  const getBorderClass = () => {
    switch (toast.type) {
      case 'completed':
        return 'border border-green-500';
      case 'important':
        return 'border border-amber-500';
      case 'incomplete':
      case 'not-important':
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        "bg-neutral-800 text-white px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-[400px] transition-all duration-300 ease-out",
        getBorderClass()
      )}
      role="alert"
      style={{
        animation: isExiting ? 'slideOutRight 0.3s ease-out forwards' : 'slideInRight 0.3s ease-out',
        transition: 'margin-top 0.3s ease-out, transform 0.3s ease-out',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0">{getIcon()}</span>
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
      <div className="fixed top-4 right-4 z-[100] flex flex-col-reverse gap-2 items-end" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </>
  );
}

