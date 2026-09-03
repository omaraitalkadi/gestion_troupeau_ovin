import { useEffect, useRef, useState, useCallback } from "react";
import {
  Settings, Lock, Eye, EyeOff, AlertCircle, Check, Loader2, User, ShieldAlert,
} from "lucide-react";
import "./parametres.css";
const API_BASE = document.location.origin || "http://localhost";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur");
  const json = await res.json();
  return json.data ?? json.user ?? json;
}
async function apiSend(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erreur");
  return json;
}

export default function Parametres() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mdpRef = useRef(null);

  const fetchUser = useCallback(async () => {
    try {
      // /me renvoie { user, ferme, lots } → apiGet retombe sur .user
      const res = await fetch(`${API_BASE}/api/utilisateur/me`, { credentials: "include" });
      const json = await res.json();
      setUser(json.user ?? null);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const forcedChange = user?.must_change_password === true;

  // Si changement forcé : focus + scroll sur le bloc mot de passe.
  useEffect(() => {
    if (forcedChange && mdpRef.current) {
      mdpRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [forcedChange]);

  if (loading) {
    return <div className="param-state"><Loader2 size={26} className="spin" /><p>Chargement…</p></div>;
  }

  return (
    <div className="parametres-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Compte</p>
          <h1 className="page-title"><Settings size={22} /> Paramètres</h1>
          <p className="page-subtitle">Gérez votre compte et votre mot de passe.</p>
        </div>
      </header>

      {/* Bannière : changement de mot de passe requis */}
      {forcedChange && (
        <div className="param-alert-forced" role="alert">
          <ShieldAlert size={20} />
          <div>
            <strong>Changement de mot de passe requis</strong>
            <p>Vous devez définir un nouveau mot de passe avant d'accéder au reste de l'application.</p>
          </div>
        </div>
      )}

      {/* Profil (lecture seule) — atténué si changement forcé */}
      <section className={`param-card${forcedChange ? " is-dimmed" : ""}`} aria-disabled={forcedChange}>
        <h2 className="param-card-title"><User size={16} /> Profil</h2>
        <div className="param-grid">
          <div className="param-row"><span>Nom</span><strong>{user?.nom ?? "—"}</strong></div>
          <div className="param-row">
            <span>{user?.role === "ADMINISTRATEUR" ? "Email" : "Identifiant"}</span>
            <strong>{user?.role === "ADMINISTRATEUR" ? (user?.email ?? "—") : (user?.username ?? "—")}</strong>
          </div>
          <div className="param-row"><span>Rôle</span><strong>{roleLabel(user?.role)}</strong></div>
        </div>
      </section>

      {/* Mot de passe — mis en avant si changement forcé */}
      <section
        ref={mdpRef}
        className={`param-card${forcedChange ? " is-highlight" : ""}`}
      >
        <h2 className="param-card-title"><Lock size={16} /> Mot de passe</h2>
        <ChangementMotDePasse forced={forcedChange} onChanged={() => { window.location.href = "/"; }} />
      </section>
    </div>
  );
}

function roleLabel(r) {
  return r === "ADMINISTRATEUR" ? "Administrateur"
    : r === "VETERINAIRE" ? "Vétérinaire"
    : r === "OPERATEUR" ? "Opérateur"
    : r === "AUTRE" ? "Autre" : (r ?? "—");
}

function ChangementMotDePasse({ forced, onChanged }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const regles = [
    { ok: newPassword.length >= 8, label: "8 caractères minimum" },
    { ok: /[A-Z]/.test(newPassword), label: "une majuscule" },
    { ok: /[0-9]/.test(newPassword), label: "un chiffre" },
  ];
  const toutesRegles = regles.every((r) => r.ok);
  const correspond = newPassword.length > 0 && newPassword === confirm;
  const peutValider = currentPassword && toutesRegles && correspond && !saving;

  const submit = async () => {
    if (!peutValider) return;
    setSaving(true); setError("");
    try {
      await apiSend("/api/auth/password", "PATCH", { currentPassword, newPassword });
      setOk(true);
      // Le changement lève must_change_password côté serveur → rechargement
      // complet pour rafraîchir /me et libérer le verrou de navigation.
      setTimeout(() => onChanged?.(), 800);
    } catch (e) {
      setError(e.message || "Une erreur est survenue.");
      setSaving(false);
    }
  };

  if (ok) {
    return (
      <div className="param-success">
        <Check size={18} /> Mot de passe modifié. Redirection…
      </div>
    );
  }

  return (
    <div className="param-form">
      {error && (
        <div className="param-error" role="alert"><AlertCircle size={15} /><span>{error}</span></div>
      )}

      <div className="param-field">
        <label>Mot de passe actuel</label>
        <div className="param-input-wrap">
          <Lock size={15} className="param-input-icon" />
          <input
            type={show ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            disabled={saving}
            placeholder={forced ? "Votre mot de passe temporaire" : "••••••••"}
          />
        </div>
      </div>

      <div className="param-field">
        <label>Nouveau mot de passe</label>
        <div className="param-input-wrap">
          <Lock size={15} className="param-input-icon" />
          <input
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            autoComplete="new-password"
            disabled={saving}
            placeholder="••••••••"
          />
          <button type="button" className="param-input-toggle" onClick={() => setShow((s) => !s)} tabIndex={-1}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <ul className="param-rules">
          {regles.map((r) => (
            <li key={r.label} className={r.ok ? "is-ok" : ""}>
              {r.ok ? <Check size={12} /> : <span className="dot" />}{r.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="param-field">
        <label>Confirmer le nouveau mot de passe</label>
        <div className="param-input-wrap">
          <Lock size={15} className="param-input-icon" />
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={saving}
            placeholder="••••••••"
          />
        </div>
        {confirm.length > 0 && !correspond && (
          <p className="param-hint-error">Les mots de passe ne correspondent pas.</p>
        )}
      </div>

      <button className="btn-primary param-submit" onClick={submit} disabled={!peutValider}>
        {saving ? (<><Loader2 size={15} className="spin" /> Modification…</>) : "Changer le mot de passe"}
      </button>

      {!forced && (
        <p className="param-note">Le mot de passe ne peut être changé qu'une fois par mois.</p>
      )}
    </div>
  );
}
