/* Confirms an action that needs a written reason (void, cancel, reject, archive). */
import { useState, type ReactNode } from "react";
import { errorMessage } from "../../lib/api.ts";
import { Button } from "./Button.tsx";
import { TextAreaField } from "./Field.tsx";
import { Notice } from "./Feedback.tsx";
import { Sheet } from "./Sheet.tsx";

interface ReasonSheetProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  placeholder?: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function ReasonSheet({ open, title, description, confirmLabel, danger, placeholder, children, onClose, onConfirm }: ReasonSheetProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };
  const submit = async () => {
    if (!reason.trim()) {
      setError("Please write a short reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      title={title}
      description={description}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Back</Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {children}
        <TextAreaField label="Reason" value={reason} placeholder={placeholder} maxLength={200} onChange={(e) => setReason(e.target.value)} hint="Saved in the audit log." />
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Sheet>
  );
}
