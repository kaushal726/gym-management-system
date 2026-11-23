/* The one place pages are guarded in the app. A page renders only when the visitor passes its guard; otherwise
 * they get the sign-in screen or a "not for you" screen, and the page's data is never requested.
 * The Worker checks every API call again on its own, so this is about a clean experience, not the only lock. */
import type { ReactNode } from "react";
import { FiGrid } from "react-icons/fi";
import { useSession } from "../../lib/session.tsx";
import { GYM_POINTS, MEMBER_POINTS } from "../../features/auth/authPoints.tsx";
import { SignInCard } from "../../features/auth/SignInCard.tsx";
import { ButtonLink } from "../ui/Button.tsx";
import { AuthLayout, BRAND_HEADING } from "./AuthLayout.tsx";
import { StatusScreen } from "./StatusScreen.tsx";

/**
 * public: anyone. member: signed in (their own data only). staff: signed in; the gym's own staff check
 * happens in the staff app, which knows the gym. platform: the GymDesk platform admin only.
 * gymSignup: signed in, self-serve gym signup switched on, not the platform admin.
 */
export type Guard = "public" | "member" | "staff" | "platform" | "gymSignup";

const SIGN_IN: Record<Exclude<Guard, "public">, { text: string; title: string; subtitle: string; member: boolean }> = {
  member: { text: "Your plan, dues and receipts in one place.", title: "See your membership", subtitle: "Sign in with the Google account you used at your gym.", member: true },
  staff: { text: "Never miss a renewal. Never lose a due.", title: "Staff sign in", subtitle: "Owners, managers and trainers sign in with Google.", member: false },
  platform: { text: "Platform admin. Onboard gyms and keep them running.", title: "Admin sign in", subtitle: "Only the GymDesk admin account can open this.", member: false },
  gymSignup: { text: "Set up your gym in a minute.", title: "Set up your gym", subtitle: "Continue with Google to start.", member: false },
};

export function Protected({ guard, children }: { guard: Guard; children: ReactNode }) {
  const { session, config } = useSession();
  if (guard === "public") return <>{children}</>;

  if (!session?.user) {
    const s = SIGN_IN[guard];
    return (
      <AuthLayout fit heading={BRAND_HEADING} text={s.text} points={s.member ? MEMBER_POINTS : GYM_POINTS} preview={s.member ? "member" : "gym"}>
        <SignInCard title={s.title} subtitle={s.subtitle} />
      </AuthLayout>
    );
  }

  if (guard === "platform" && !session.isPlatformAdmin) {
    return <StatusScreen art="locked" title="This page is for GymDesk admins" text="Gym owners and staff manage their gym from the gym's own page." />;
  }

  if (guard === "gymSignup" && (!config?.allowGymSignup || session.isPlatformAdmin)) {
    return (
      <StatusScreen
        art="locked"
        title="Gyms are set up by GymDesk"
        text="Please contact GymDesk to get your gym onboarded."
        actions={
          session.isPlatformAdmin ? (
            <ButtonLink href="/platform" variant="primary" icon={<FiGrid />}>
              Open platform console
            </ButtonLink>
          ) : undefined
        }
      />
    );
  }

  return <>{children}</>;
}
