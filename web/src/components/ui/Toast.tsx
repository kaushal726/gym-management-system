import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

interface ToastItem {
  id: number;
  text: string;
  tone: "success" | "error";
}

const ToastContext = createContext<(text: string, tone?: ToastItem["tone"]) => void>(() => undefined);
const TOAST_MS = 3200;
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: ToastItem["tone"] = "success") => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.tone === "error" ? " toast--error" : ""}`}>
            {t.tone === "error" ? <FiAlertCircle aria-hidden /> : <FiCheck aria-hidden />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
