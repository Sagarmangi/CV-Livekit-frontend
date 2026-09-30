"use server";

import { redirect } from "next/navigation";

import { isEmailAllowed } from "@/lib/auth";
import { fail, guard, str, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  return guard(async () => {
    const email = str(form, "email").toLowerCase();
    const password = str(form, "password");

    if (!email || !password) {
      return fail("Enter your email and password.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // Same message either way -- don't reveal whether the account exists.
    if (error) return fail("Incorrect email or password.");

    // Checked immediately rather than waiting for the protected layout to
    // catch it one request later -- a valid Supabase Auth account isn't
    // enough on its own, only accounts listed in allowed_users are.
    if (!(await isEmailAllowed(email))) {
      await supabase.auth.signOut();
      return fail("That account isn't authorized for this dashboard.");
    }

    redirect("/agents");
  });
}
