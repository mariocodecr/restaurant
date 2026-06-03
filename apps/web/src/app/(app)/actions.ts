"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Triggered from the user menu in the app shell. Clears the Supabase
// session cookies on the server (the createServerClient cookies callback
// writes the delete instructions), revalidates so any cached server
// component re-runs against a logged-out state, then sends the user
// back to /login.
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
