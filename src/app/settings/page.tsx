import { requireAppUser } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";
import { EmailForm } from "./EmailForm";

export default async function SettingsPage() {
  const user = await requireAppUser("/settings");

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Profile</h2>
        <div className="mt-3">
          <ProfileForm
            initialUsername={user.username ?? ""}
            initialFirstName={user.firstName ?? ""}
            initialLastName={user.lastName ?? ""}
            initialCity={user.city ?? ""}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Email</h2>
        <div className="mt-3">
          <EmailForm currentEmail={user.email} />
        </div>
      </section>
    </main>
  );
}
