import { OrgSwitcher, type OrgOption } from "./org-switcher";
import { UserMenu } from "./user-menu";

interface AppTopbarProps {
  orgs: OrgOption[];
  currentOrgId: string;
  user: {
    email: string;
    fullName: string | null;
  };
}

export function AppTopbar({ orgs, currentOrgId, user }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[--gold-400]/15 bg-[#0a0908]/55 px-6 backdrop-blur-xl">
      <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} />
      <UserMenu fullName={user.fullName} email={user.email} />
    </header>
  );
}
