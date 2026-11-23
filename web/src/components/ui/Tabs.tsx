/* A tab bar: underlined active tab, optional count pill on each tab. */
export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly TabOption<T>[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" className="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tab__count">{o.count > 99 ? "99+" : o.count}</span>}
        </button>
      ))}
    </div>
  );
}
