import { redirect } from "react-router";

// A reusable guard you call at the top of any protected loader
export async function requireAuth(request) {
  const res = await fetch("/api/utilisateur/me", {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!res.ok) {
    const from = new URL(request.url).pathname;
    throw redirect(`/login?from=${encodeURIComponent(from)}`);
  }
  const data = await res.json(); // { user, ferme, ... }

  // Verrou : must_change_password → seule /parametres est accessible.
  const pathname = new URL(request.url).pathname;
  if (data.user?.must_change_password === true && pathname !== "/parametres") {
    throw redirect("/parametres");
  }

  return data;
}