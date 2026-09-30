import { login } from "@/app/login/actions";
import { BrandWordmark } from "@/components/brand-mark";
import { ActionForm } from "@/components/form";
import { Field, Input } from "@/components/ui";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That account isn't authorized for this dashboard.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const errorParam = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] : null;

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10 sm:px-10 sm:py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center">
          {/* The logo carries the wordmark itself, so the mark and the set
              type that used to sit beside it would both be duplicates. */}
          <BrandWordmark height={60} />
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-lg sm:p-7">
          <div className="mb-6 text-center">
            <h1 className="text-2xl">Sign in to your account</h1>
            <p className="mt-2 text-sm text-muted">
              Configure agents, numbers and call logs from one dashboard.
            </p>
          </div>

          {errorMessage && (
            <p className="mb-5 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text">
              {errorMessage}
            </p>
          )}

          <ActionForm
            action={login}
            submitLabel="Sign in"
            pendingLabel="Signing in…"
            submitFullWidth
          >
            <Field label="Email address" htmlFor="login-email">
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@kodexolabs.com"
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </ActionForm>
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Access is limited to authorized Kodexo Labs accounts.
        </p>
      </div>
    </div>
  );
}
