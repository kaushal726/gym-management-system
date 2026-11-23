/* Plans the gym sells: memberships and personal-training packages. A price change never touches existing plans. */
import { useEffect, useState } from "react";
import { FiEdit2, FiLayers, FiPlus } from "react-icons/fi";
import type { Plan, PlanInput } from "../../../../shared/api.ts";
import type { PlanKind } from "../../../../shared/constants.ts";
import { formatRupees, paiseToInput, rupeesToPaise } from "../../../../shared/money.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { planLength } from "../../lib/format.ts";
import { useApi } from "../../lib/useApi.ts";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { MoneyField, Segmented, Switch, TextField } from "../../components/ui/Field.tsx";
import { Badge, EmptyState, ErrorState, ListSkeleton, Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { useAdmin } from "./AdminShell.tsx";

type Unit = "months" | "days";

function PlanSheet({ open, plan, gymId, onClose, onSaved }: { open: boolean; plan: Plan | null; gymId: string; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<PlanKind>("MEMBERSHIP");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("months");
  const [length, setLength] = useState("1");
  const [price, setPrice] = useState("");
  const [freeze, setFreeze] = useState("0");
  const [commission, setCommission] = useState("0");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(plan?.kind ?? "MEMBERSHIP");
    setName(plan?.name ?? "");
    setUnit(plan?.durationDays != null ? "days" : "months");
    setLength(String(plan?.durationMonths ?? plan?.durationDays ?? 1));
    setPrice(plan ? paiseToInput(plan.pricePaise) : "");
    setFreeze(String(plan?.maxFreezeDays ?? 0));
    setCommission(String(plan?.trainerCommissionPct ?? 0));
    setActive(plan?.active ?? true);
    setError(null);
  }, [open, plan]);

  const save = async () => {
    const pricePaise = rupeesToPaise(price);
    if (pricePaise == null) {
      setError({ message: "Please enter a valid price.", field: "pricePaise" });
      return;
    }
    const n = Number(length);
    const body: PlanInput = {
      kind,
      name,
      durationMonths: unit === "months" ? n : null,
      durationDays: unit === "days" ? n : null,
      pricePaise,
      maxFreezeDays: Number(freeze) || 0,
      trainerCommissionPct: kind === "PT" ? Number(commission) || 0 : 0,
      active,
    };
    setBusy(true);
    setError(null);
    try {
      if (plan) await api.patch(`/gyms/${gymId}/plans/${plan.id}`, body);
      else await api.post(`/gyms/${gymId}/plans`, body);
      onSaved();
    } catch (err) {
      setError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };
  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  return (
    <Sheet
      open={open}
      title={plan ? "Edit plan" : "New plan"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Save plan
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Segmented
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "MEMBERSHIP", label: "Membership" },
            { value: "PT", label: "Personal training" },
          ]}
        />
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "PT" ? "PT 12 sessions" : "Quarterly"} maxLength={60} error={fieldError("name")} />
        <div className="form-grid form-grid--2">
          <TextField label="Length" type="number" inputMode="numeric" min={1} value={length} onChange={(e) => setLength(e.target.value)} error={fieldError("durationMonths") ?? fieldError("durationDays")} />
          <Segmented
            label="In"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "months", label: "Months" },
              { value: "days", label: "Days" },
            ]}
          />
        </div>
        <div className="form-grid form-grid--2">
          <MoneyField label="Price" value={price} onChange={(e) => setPrice(e.target.value)} error={fieldError("pricePaise")} />
          <TextField label="Freeze days allowed" type="number" inputMode="numeric" min={0} value={freeze} onChange={(e) => setFreeze(e.target.value)} error={fieldError("maxFreezeDays")} hint="0 means no freezes." />
        </div>
        {kind === "PT" && <TextField label="Trainer commission (%)" type="number" inputMode="numeric" min={0} max={100} value={commission} onChange={(e) => setCommission(e.target.value)} error={fieldError("trainerCommissionPct")} hint="Shown in Reports for paying trainers." />}
        {plan && <Switch checked={active} onChange={setActive} label="Available for new sign-ups" hint="Turning off keeps existing members on this plan." />}
        {plan && <Notice tone="info">Changes apply to new and renewed plans only. Running plans keep their price.</Notice>}
        {error && !error.field && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Sheet>
  );
}

export function PlansPage() {
  const { gymId, isOwner } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: Plan[] }>(`/gyms/${gymId}/plans`);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Plans</h1>
          <p>What you sell at the desk.</p>
        </div>
        {isOwner && (
          <Button variant="primary" icon={<FiPlus />} onClick={() => setEditing("new")}>
            New plan
          </Button>
        )}
      </div>
      <div className="card">
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={3} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<FiLayers />}
            title="No plans yet"
            text="Add your monthly, quarterly and yearly plans to start activating members."
            action={
              isOwner ? (
                <Button variant="primary" icon={<FiPlus />} onClick={() => setEditing("new")}>
                  New plan
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="list">
            {data?.items.map((p) => (
              <div className="list-row" key={p.id} style={{ opacity: p.active ? 1 : 0.6 }}>
                <span className="list-row__main">
                  <span className="list-row__title">{p.name}</span>
                  <span className="list-row__sub">
                    {planLength(p.durationMonths, p.durationDays)}
                    {p.maxFreezeDays ? ` · ${p.maxFreezeDays} freeze days` : ""}
                    {p.kind === "PT" && p.trainerCommissionPct ? ` · ${p.trainerCommissionPct}% to trainer` : ""}
                  </span>
                </span>
                <span className="list-row__end">
                  <span className="tabular" style={{ fontWeight: 700 }}>
                    {formatRupees(p.pricePaise)}
                  </span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {p.kind === "PT" && <Badge tone="accent">PT</Badge>}
                    {!p.active && <Badge>Hidden</Badge>}
                  </span>
                </span>
                {isOwner && <IconButton label={`Edit ${p.name}`} icon={<FiEdit2 />} onClick={() => setEditing(p)} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <PlanSheet
        open={editing != null}
        plan={editing === "new" ? null : editing}
        gymId={gymId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast("Plan saved");
          reload();
        }}
      />
    </div>
  );
}
