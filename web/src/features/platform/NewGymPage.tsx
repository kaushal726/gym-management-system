/* /new-gym — self-serve: a gym owner sets up their own gym. Guarded by "gymSignup" (off on the live site). */
import { navigate } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { GymCreateForm } from "./GymCreateForm.tsx";

export function NewGymPage() {
  const { refresh } = useSession();
  return (
    <NarrowLayout title="Create your gym">
      <div className="card card--pad form-grid enter">
        <div>
          <h1>Set up your gym</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Takes a minute. You can add plans and staff next.
          </p>
        </div>
        <GymCreateForm
          endpoint="/platform/signup-gym"
          askOwner={false}
          onCreated={(id) => {
            void refresh().then(() => navigate(`/admin/${id}/plans`));
          }}
        />
      </div>
    </NarrowLayout>
  );
}
