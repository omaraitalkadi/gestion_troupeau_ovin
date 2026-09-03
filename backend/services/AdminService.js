// server/services/AdminService.js
import { supabase } from "../lib/supabase.js";
import { hashPassword } from "./AuthService.js";

const WRITABLE = ["email", "nom", "prenom", "telephone", "role", "actif", "exploitation_id"];
const pick = (body) => Object.fromEntries(
  Object.entries(body).filter(([k]) => WRITABLE.includes(k))
);

export async function getUsers({ page = 1, limit = 50, search, role, actif }) {
  let query = supabase
    .from("utilisateurs")
    .select("id, email, nom, prenom, role, actif, telephone, derniere_connexion, date_creation, exploitation_id, exploitations(nom)", { count: "exact" })
    .order("date_creation", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  if (role   !== undefined) query = query.eq("role",  role);
  if (actif  !== undefined) query = query.eq("actif", actif);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function getUserById(id) {
  const { data, error } = await supabase
    .from("utilisateurs")
    .select("id, email, nom, prenom, role, actif, telephone, derniere_connexion, date_creation, exploitation_id, exploitations(nom)")
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
  return data;
}

export async function createUser({ email, nom, prenom, telephone, role, password, exploitation_id }) {
  if (!email)    throw Object.assign(new Error("email requis"),    { status: 400 });
  if (!nom)      throw Object.assign(new Error("nom requis"),      { status: 400 });
  if (!password) throw Object.assign(new Error("password requis"), { status: 400 });

  // Check unicité email
  const { data: existing } = await supabase
    .from("utilisateurs")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (existing) throw Object.assign(new Error("Un compte avec cet email existe déjà"), { status: 409 });

  const password_hash = await hashPassword(password);

  // Créer d'abord dans auth.users (Supabase Auth)
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  });
  if (authErr) throw authErr;

  // Puis mettre à jour la ligne créée par le trigger
  const { data, error } = await supabase
    .from("utilisateurs")
    .update({ nom, prenom: prenom ?? "", telephone, role: role ?? "ELEVEUR", exploitation_id, password_hash })
    .eq("id", authUser.user.id)
    .select("id, email, nom, prenom, role, actif")
    .single();

  if (error) throw error;
  return data;
}

export async function updateUser(id, body) {
  const payload = pick(body);

  const { data, error } = await supabase
    .from("utilisateurs")
    .update(payload)
    .eq("id", id)
    .select("id, email, nom, prenom, role, actif")
    .single();

  if (error) throw error;
  if (!data) throw Object.assign(new Error("Utilisateur introuvable"), { status: 404 });
  return data;
}

export async function suspendUser(id) {
  const { data, error } = await supabase
    .from("utilisateurs")
    .update({ actif: false })
    .eq("id", id)
    .select("id, email, actif")
    .single();

  if (error) throw error;

  // Révoquer toutes les sessions
  await supabase
    .from("sessions")
    .update({ revoked: true })
    .eq("user_id", id);

  return data;
}

export async function activateUser(id) {
  const { data, error } = await supabase
    .from("utilisateurs")
    .update({ actif: true })
    .eq("id", id)
    .select("id, email, actif")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUser(id) {
  // Supprimer de auth.users (cascade vers utilisateurs via FK)
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw error;
}
