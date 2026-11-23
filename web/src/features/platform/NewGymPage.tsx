/* /new-gym — self-serve: a gym owner signs in and sets up their own gym (when signup is switched on). */
import { FiSlash } from "react-icons/fi";
import { navigate } from "../../lib/router.tsx";
import { useSession } from "../../lib/session.tsx";
import { NarrowLayout } from "../../components/layout/NarrowLayout.tsx";
import { EmptyState } from "../../components/ui/Feedback.tsx";
import { SignInCard } from "../auth/SignInCard.tsx";
import { AuthLayout } from "../../components/layout/AuthLayout.tsx";
import { GYM_POINTS } from "../auth/authPoints.tsx";
import { GymCreateForm } from "./GymCreateForm.tsx";

export function NewGymPage() {
  const { session, config, refresh } = useSession();
  if (!session?.user) {
    return (
      <AuthLayout heading="Set up your gym in a minute." text="Sign in with the Google account you'll use as the owner." points={GYM_POINTS}>
        <SignInCard title="Set up your gym" subtitle="Continue with Google to start." />
      </AuthLayout>
    );
  }
  if (!config?.allowGymSignup || session.isPlatformAdmin) {
    return (
      <NarrowLayout title="Create your gym">
        <EmptyState icon={<FiSlash />} title="Sign-ups are closed" text="Please contact us to get your gym set up." />
      </NarrowLayout>
    );
  }
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
