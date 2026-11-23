/* Staff: invite by Google email. Managers run the desk but never see revenue or edit money. */
import { useState } from "react";
import { PiUserCheckDuotone, PiUserPlusBold } from "react-icons/pi";
import type { StaffEntry } from "../../../../shared/api.ts";
import type { TeamRole } from "../../../../shared/constants.ts";
import { api, errorField, errorMessage } from "../../lib/api.ts";
import { useSession } from "../../lib/session.tsx";
import { useApi } from "../../lib/useApi.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Segmented, TextField } from "../../components/ui/Field.tsx";
import { Avatar, Badge, EmptyState, ErrorState, ListSkeleton, Notice } from "../../components/ui/Feedback.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { useToast } from "../../components/ui/Toast.tsx";
import { ROLE_LABEL } from "../../lib/states.ts";
import { useAdmin } from "./AdminShell.tsx";

const ROLE_HELP: Record<TeamRole, string> = {
  TRAINER: "Runs the desk like a manager: members, plans, payments, check-ins. Cannot see sales, reports or the audit log.",
  MANAGER: "Runs the desk: members, plans, payments, check-ins. Cannot see sales, reports or the audit log.",
};

export function StaffPage() {
  const { gymId } = useAdmin();
  const { session } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ items: StaffEntry[] }>(`/gyms/${gymId}/staff`);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("TRAINER");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<{ message: string; field?: string } | null>(null);

  const invite = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`/gyms/${gymId}/staff`, { email, role });
      setInviting(false);
      setEmail("");
      toast("Invite saved. They get access when they sign in with that Google account.");
      reload();
    } catch (err) {
      setFormError({ message: errorMessage(err), field: errorField(err) });
    } finally {
      setBusy(false);
    }
  };
  const update = async (s: StaffEntry, next: { active: boolean; role: TeamRole }) => {
    try {
      await api.patch(`/gyms/${gymId}/staff/${encodeURIComponent(s.email)}`, next);
      toast(next.active ? "Access updated" : "Access removed");
      reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <p>Managers and trainers run the desk. Sales, reports and the audit log stay with you.</p>
        </div>
        <Button variant="primary" icon={<PiUserPlusBold />} onClick={() => setInviting(true)}>
          Invite
        </Button>
      </div>
      <div className="card">
        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={2} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<PiUserCheckDuotone />} title="Just you for now" />
        ) : (
          <div className="list">
            {data?.items.map((s) => {
              const editable = s.role !== "OWNER" && s.email !== session?.user?.email;
              return (
                <div className="list-row" key={s.email} style={{ opacity: s.active ? 1 : 0.6 }}>
                  <Avatar name={s.userName ?? s.email} />
                  <span className="list-row__main">
                    <span className="list-row__title">{s.userName ?? s.email}</span>
                    <span className="list-row__sub">
                      {ROLE_LABEL[s.role]} · {s.email}
                    </span>
                    {(!s.linked && s.active) || !s.active ? (
                      <span style={{ marginTop: 4 }}>{s.active ? <Badge tone="warning">Not signed in yet</Badge> : <Badge tone="danger">Removed</Badge>}</span>
                    ) : null}
                  </span>
                  {editable ? (
                    s.active ? (
                      <Button size="sm" variant="danger-ghost" onClick={() => void update(s, { active: false, role: s.role as TeamRole })}>
                        Remove
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void update(s, { active: true, role: s.role as TeamRole })}>
                        Restore
                      </Button>
                    )
                  ) : (
                    <Badge tone="accent">{ROLE_LABEL[s.role]}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Sheet
        open={inviting}
        title="Invite staff"
        description="They sign in with Google using this email."
        onClose={() => setInviting(false)}
        footer={
          <>
            <Button onClick={() => setInviting(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void invite()}>
              Send invite
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <TextField label="Google email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" autoComplete="off" error={formError?.field === "email" ? formError.message : null} />
          <Segmented
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: "TRAINER", label: "Trainer" },
              { value: "MANAGER", label: "Manager" },
            ]}
          />
          <Notice tone="info">{ROLE_HELP[role]}</Notice>
          {formError && formError.field !== "email" && <Notice tone="danger">{formError.message}</Notice>}
        </div>
      </Sheet>
    </div>
  );
}
