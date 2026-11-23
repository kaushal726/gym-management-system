import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}

export function Field({ label, optional, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} {optional && <small>(optional)</small>}
      </label>
      {children({ id, ...(error ? { "aria-invalid": true as const } : {}), ...(describedBy ? { "aria-describedby": describedBy } : {}) })}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

type Base = { label: string; optional?: boolean; hint?: string; error?: string | null };

export function TextField({ label, optional, hint, error, ...input }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      {(a11y) => <input className="input" {...a11y} {...input} />}
    </Field>
  );
}

export function SelectField({ label, optional, hint, error, children, ...select }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      {(a11y) => (
        <select className="input" {...a11y} {...select}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, optional, hint, error, ...area }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      {(a11y) => <textarea className="input" {...a11y} {...area} />}
    </Field>
  );
}

/** Rupee amount typed as text; the parent converts with rupeesToPaise. */
export function MoneyField({ label, optional, hint, error, ...input }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      {(a11y) => (
        <div className="input-affix">
          <span className="input-affix__prefix" aria-hidden>
            ₹
          </span>
          <input className="input tabular" inputMode="decimal" autoComplete="off" {...a11y} {...input} />
        </div>
      )}
    </Field>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <span className="switch__text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden />
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, optional }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; label: string; optional?: boolean }) {
  return (
    <div className="field">
      <span className="field__label">
        {label} {optional && <small>(optional)</small>}
      </span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
