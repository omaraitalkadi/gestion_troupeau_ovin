import { useState, useEffect, useCallback, useMemo } from "react";
import { useLoaderData, useRouteLoaderData } from "react-router";
import {
  Users, UserPlus, X, Loader2, ServerCrash, RefreshCw, ShieldCheck,
  Bell, Check, Ban, ChevronLeft, Copy,
} from "lucide-react";
import "./Utilisateurs.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const ROLE_LABEL = {
  ADMINISTRATEUR: "Administrateur",
  VETERINAIRE: "Vétérinaire",
  OPERATEUR: "Opérateur",
  AUTRE: "Autre",
};

const MODULE_LABEL = {
  TROUPEAU: "Troupeau",
  SANTE: "Santé",
  REPRODUCTION: "Reproduction",
  ALIMENTATION: "Alimentation",
  FINANCE: "Finances",
};

const ACTION_LABEL = { LIRE: "Consulter", ECRIRE: "Modifier", SUPPRIMER: "Supprimer" };
const ACTIONS = ["LIRE", "ECRIRE", "SUPPRIMER"];

const TYPE_ALERTE_LABEL = {
  SANTE: "Santé générale",
  VACCINATION: "Vaccinations",
  TRAITEMENT_ANTIPARASITAIRE: "Traitements antiparasitaires",
  REPRODUCTION_CHALEURS: "Chaleurs",
  REPRODUCTION_MISE_BAS: "Mises bas",
  REPRODUCTION_INSEMINATION: "Inséminations",
  GESTATION_RETARD: "Gestations en retard",
  STOCK_ALIMENT_FAIBLE: "Stock d'aliments faible",
  STOCK_MEDICAMENT_FAIBLE: "Stock de médicaments faible",
  MOUVEMENT_ANIMAL: "Mouvements d'animaux",
  PESEE_CONTROL: "Pesées de contrôle",
  ANOMALIE_SANTE: "Anomalies de santé",
  SAUVEGARDE: "Sauvegardes",
};

const TYPE_GROUPE = {
  Santé: ["SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE", "ANOMALIE_SANTE"],
  Reproduction: ["REPRODUCTION_CHALEURS", "REPRODUCTION_MISE_BAS", "REPRODUCTION_INSEMINATION", "GESTATION_RETARD"],
  Stocks: ["STOCK_ALIMENT_FAIBLE", "STOCK_MEDICAMENT_FAIBLE"],
  Troupeau: ["MOUVEMENT_ANIMAL", "PESEE_CONTROL"],
  Système: ["SAUVEGARDE"],
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Interrupteur réutilisable
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`toggle${checked ? " is-on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || (json.errors || []).join(", ") || `Erreur ${res.status}`);
  return json.data;
}
async function apiSend(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || (json.errors || []).join(", ") || `Erreur ${res.status}`);
  return json.data;
}

// L'utilisateur courant vient du loader de la route parent (requireAuth attaché à "/",
// lu via useRouteLoaderData("root")), avec repli sur le loader local puis sur un fetch.
export default function Utilisateurs() {
  const rootData = useRouteLoaderData("root");
  const ownData = useLoaderData();
  const fromLoader = rootData?.user ?? ownData?.user ?? null;

  const [currentUser, setCurrentUser] = useState(fromLoader);
  const [loading, setLoading] = useState(!fromLoader);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/utilisateur/me`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        setCurrentUser(json.user ?? json.data ?? json);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  if (loading) return <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement…</p></div>;
  if (error || !currentUser) {
    return (
      <div className="table-state is-error">
        <ServerCrash size={28} /><p>{error || "Utilisateur introuvable."}</p>
      </div>
    );
  }

  const estAdmin = currentUser.role === "ADMINISTRATEUR";
  return estAdmin ? <ConsoleAdmin currentUser={currentUser} /> : <MonProfil />;
}

/* ───────────────────────── Console admin ───────────────────────── */

function ConsoleAdmin({ currentUser }) {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fetchListe = useCallback(async () => {
    setLoading(true); setError(null);
    try { setUtilisateurs(await apiGet("/api/utilisateur")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchListe(); }, [fetchListe]);

  if (selectedId) {
    return (
      <DetailUtilisateur
        id={selectedId}
        currentUser={currentUser}
        onBack={() => setSelectedId(null)}
        onChanged={fetchListe}
      />
    );
  }

  return (
    <div className="utilisateurs-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ferme · Accès</p>
          <h1 className="page-title"><Users size={22} /> Utilisateurs</h1>
          <p className="page-subtitle">Gérez les comptes, les permissions et les notifications de votre équipe.</p>
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={fetchListe} disabled={loading} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Créer un utilisateur
          </button>
        </div>
      </header>

      {loading && <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement…</p></div>}

      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} /><p>{error}</p>
          <button className="btn-secondary" onClick={fetchListe}><RefreshCw size={14} /> Réessayer</button>
        </div>
      )}

      {!loading && !error && utilisateurs.length === 0 && (
        <div className="table-state">
          <p className="muted">Aucun employé pour l'instant. Créez le premier compte pour votre équipe.</p>
        </div>
      )}

      {!loading && !error && utilisateurs.length > 0 && (
        <table className="programme-table">
          <thead>
            <tr>
              <th>Nom</th><th>Email</th><th>Rôle</th><th>Créé le</th><th>Dernier accès</th><th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((u) => (
              <tr key={u.id} className={!u.actif ? "is-inactive" : ""}>
                <td>
                  <button className="link-cell" onClick={() => setSelectedId(u.id)}>{u.nom}</button>
                </td>
                <td>{u.email}</td>
                <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                <td>{fmtDate(u.date_creation)}</td>
                <td>{fmtDate(u.dernier_acces)}</td>
                <td>
                  <span className={`programme-badge${u.actif ? " is-active" : ""}`}>
                    {u.actif ? "Actif" : "Désactivé"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreerUtilisateurModal
          onClose={() => setShowCreate(false)}
          onSuccess={(nouvel) => { setShowCreate(false); fetchListe(); setSelectedId(nouvel.id); }}
        />
      )}
    </div>
  );
}

/* ───────────────────── Détail / édition d'un utilisateur ───────────────────── */

function DetailUtilisateur({ id, currentUser, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onglet, setOnglet] = useState("permissions");

  const fetchTout = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [detail, cat] = await Promise.all([
        apiGet(`/api/utilisateur/${id}`),
        apiGet("/api/utilisateur/permissions/catalogue"),
      ]);
      setData(detail); setCatalogue(Array.isArray(cat) ? cat : (cat.catalogue ?? []));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchTout(); }, [fetchTout]);

  const estAdminCible = data?.role === "ADMINISTRATEUR";

  return (
    <div className="utilisateurs-page">
      <header className="page-header">
        <div>
          <button className="link" onClick={onBack}><ChevronLeft size={14} /> Tous les utilisateurs</button>
          <h1 className="page-title">
            <Users size={22} /> {loading ? "Chargement…" : data?.nom}
          </h1>
          {data && (
            <p className="page-subtitle">{ROLE_LABEL[data.role] ?? data.role} · {data.username ?? data.email ?? "—"}</p>
          )}
        </div>
        {data && !estAdminCible && (
          <div className="page-actions">
            <BoutonStatut
              utilisateur={data}
              estSoiMeme={data.id === currentUser?.id}
              onDone={() => { fetchTout(); onChanged?.(); }}
            />
          </div>
        )}
      </header>

      {loading && <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement…</p></div>}

      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} /><p>{error}</p>
          <button className="btn-secondary" onClick={fetchTout}><RefreshCw size={14} /> Réessayer</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <nav className="tab-bar">
            <button className={onglet === "permissions" ? "is-active" : ""} onClick={() => setOnglet("permissions")}>
              <ShieldCheck size={15} /> Permissions
            </button>
            <button className={onglet === "notifications" ? "is-active" : ""} onClick={() => setOnglet("notifications")}>
              <Bell size={15} /> Notifications
            </button>
          </nav>

          {onglet === "permissions" && (
            estAdminCible
              ? <p className="modal-summary"><ShieldCheck size={14} /> L'administrateur possède tous les droits sur la ferme. Sa matrice n'est pas modifiable.</p>
              : <MatricePermissions id={id} catalogue={catalogue} initiales={data.permissions} onSaved={fetchTout} />
          )}

          {onglet === "notifications" && (
            <MatriceNotifications id={id} initiales={data.notifications} onSaved={fetchTout} />
          )}
        </>
      )}
    </div>
  );
}

function BoutonStatut({ utilisateur, estSoiMeme, onDone }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const basculer = async () => {
    setSaving(true); setErr(null);
    try {
      await apiSend(`/api/utilisateur/${utilisateur.id}/statut`, "PATCH", { actif: !utilisateur.actif });
      onDone?.();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  if (estSoiMeme) return null;

  return (
    <>
      <button
        className={utilisateur.actif ? "btn-danger" : "btn-primary"}
        onClick={basculer}
        disabled={saving}
      >
        {saving ? <Loader2 size={14} className="spin" />
          : utilisateur.actif ? <><Ban size={14} /> Désactiver</> : <><Check size={14} /> Réactiver</>}
      </button>
      {err && <p className="form-error">{err}</p>}
    </>
  );
}

/* ───────────────────────── Matrice permissions ───────────────────────── */

function MatricePermissions({ id, catalogue, initiales, onSaved }) {
  const cle = (m, a) => `${m}:${a}`;
  const initSet = useMemo(
    () => new Set(initiales.filter((p) => p.accorde).map((p) => cle(p.module, p.action))),
    [initiales]
  );
  const [accordees, setAccordees] = useState(initSet);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  useEffect(() => { setAccordees(initSet); }, [initSet]);

  const modules = useMemo(() => [...new Set(catalogue.map((c) => c.module))], [catalogue]);
  const aCombinaison = (m, a) => catalogue.some((c) => c.module === m && c.action === a);

  const modifie = useMemo(() => {
    if (accordees.size !== initSet.size) return true;
    for (const k of accordees) if (!initSet.has(k)) return true;
    return false;
  }, [accordees, initSet]);

  const toggle = (m, a) => {
    setOk(false);
    setAccordees((prev) => {
      const next = new Set(prev);
      const k = cle(m, a);
      if (next.has(k)) next.delete(k);
      else { next.add(k); if (a !== "LIRE") next.add(cle(m, "LIRE")); } // écrire/supprimer implique lire
      return next;
    });
  };

  const enregistrer = async () => {
    setSaving(true); setError(null); setOk(false);
    try {
      const permissions = catalogue.map((c) => ({
        module: c.module, action: c.action, accorde: accordees.has(cle(c.module, c.action)),
      }));
      await apiSend(`/api/utilisateur/${id}/permissions`, "PUT", { permissions });
      setOk(true); onSaved?.();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <section>
      <table className="matrice-table">
        <thead>
          <tr>
            <th>Module</th>
            {ACTIONS.map((a) => <th key={a}>{ACTION_LABEL[a]}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m}>
              <td className="matrice-module">{MODULE_LABEL[m] ?? m}</td>
              {ACTIONS.map((a) => (
                <td key={a} className="matrice-cell">
                  {aCombinaison(m, a) ? (
                    <Toggle
                      checked={accordees.has(cle(m, a))}
                      disabled={a === "LIRE" && (accordees.has(cle(m, "ECRIRE")) || accordees.has(cle(m, "SUPPRIMER")))}
                      onChange={() => toggle(m, a)}
                    />
                  ) : <span className="muted">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="matrice-footer">
        {error && <p className="form-error">{error}</p>}
        {ok && !modifie && <p className="form-ok"><Check size={14} /> Permissions enregistrées.</p>}
        <button className="btn-primary" onClick={enregistrer} disabled={!modifie || saving}>
          {saving ? <><Loader2 size={14} className="spin" /> Enregistrement…</> : "Enregistrer les permissions"}
        </button>
      </div>
    </section>
  );
}

/* ───────────────────────── Matrice notifications ───────────────────────── */

function MatriceNotifications({ id, initiales, onSaved }) {
  const initMap = useMemo(() => {
    const m = {};
    initiales.forEach((n) => { m[n.type_alerte] = n.actif; });
    return m;
  }, [initiales]);

  const [etat, setEtat] = useState(initMap);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  useEffect(() => { setEtat(initMap); }, [initMap]);

  const modifie = useMemo(
    () => Object.keys(initMap).some((t) => !!etat[t] !== !!initMap[t]),
    [etat, initMap]
  );

  const toggle = (t) => { setOk(false); setEtat((p) => ({ ...p, [t]: !p[t] })); };

  const enregistrer = async () => {
    setSaving(true); setError(null); setOk(false);
    try {
      const notifications = Object.keys(initMap).map((t) => ({ type_alerte: t, actif: !!etat[t] }));
      await apiSend(`/api/utilisateur/${id}/notifications`, "PUT", { notifications });
      setOk(true); onSaved?.();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const typesPresents = new Set(initiales.map((n) => n.type_alerte));

  return (
    <section>
      {Object.entries(TYPE_GROUPE).map(([groupe, types]) => {
        const visibles = types.filter((t) => typesPresents.has(t));
        if (visibles.length === 0) return null;
        return (
          <div key={groupe} className="notif-groupe">
            <h3 className="notif-groupe-titre">{groupe}</h3>
            {visibles.map((t) => (
              <label key={t} className="notif-ligne">
                <span>{TYPE_ALERTE_LABEL[t] ?? t}</span>
                <Toggle checked={!!etat[t]} onChange={() => toggle(t)} />
              </label>
            ))}
          </div>
        );
      })}

      <div className="matrice-footer">
        {error && <p className="form-error">{error}</p>}
        {ok && !modifie && <p className="form-ok"><Check size={14} /> Notifications enregistrées.</p>}
        <button className="btn-primary" onClick={enregistrer} disabled={!modifie || saving}>
          {saving ? <><Loader2 size={14} className="spin" /> Enregistrement…</> : "Enregistrer les notifications"}
        </button>
      </div>
    </section>
  );
}

/* ───────────────────────── Modale création ───────────────────────── */

function CreerUtilisateurModal({ onClose, onSuccess }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState("OPERATEUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [creee, setCreee] = useState(null); // compte créé -> écran récap copiable (username + mot de passe temporaire)

  // Catalogue + modèles chargés une fois
  const [catalogue, setCatalogue] = useState([]);
  const [modelesPerms, setModelesPerms] = useState({});
  const [modelesNotifs, setModelesNotifs] = useState({});
  const [typesAlerte, setTypesAlerte] = useState([]);
  const [chargement, setChargement] = useState(true);

  // État coché (rempli par le modèle du rôle, ajustable ensuite)
  const [permsAccordees, setPermsAccordees] = useState(new Set());
  const [notifsActives, setNotifsActives] = useState(new Set());
  const [permsOuvert, setPermsOuvert] = useState(true);
  const [notifsOuvert, setNotifsOuvert] = useState(true);

  const cle = (m, a) => `${m}:${a}`;

  // Modèles de repli si le backend ne renvoie qu'un tableau plat (ancienne forme).
  const MODELES_PERMS_FALLBACK = {
    VETERINAIRE: { TROUPEAU: ["LIRE"], SANTE: ["LIRE", "ECRIRE"], REPRODUCTION: ["LIRE", "ECRIRE"], ALIMENTATION: ["LIRE"], FINANCE: [] },
    OPERATEUR: { TROUPEAU: ["LIRE", "ECRIRE"], SANTE: ["LIRE", "ECRIRE"], REPRODUCTION: ["LIRE", "ECRIRE"], ALIMENTATION: ["LIRE", "ECRIRE"], FINANCE: [] },
    AUTRE: { TROUPEAU: ["LIRE"], SANTE: ["LIRE"], REPRODUCTION: ["LIRE"], ALIMENTATION: ["LIRE"], FINANCE: [] },
  };
  const MODELES_NOTIFS_FALLBACK = {
    VETERINAIRE: ["SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE", "ANOMALIE_SANTE", "REPRODUCTION_CHALEURS", "REPRODUCTION_MISE_BAS", "REPRODUCTION_INSEMINATION", "GESTATION_RETARD", "STOCK_MEDICAMENT_FAIBLE"],
    OPERATEUR: ["SANTE", "VACCINATION", "TRAITEMENT_ANTIPARASITAIRE", "REPRODUCTION_MISE_BAS", "STOCK_ALIMENT_FAIBLE", "STOCK_MEDICAMENT_FAIBLE", "MOUVEMENT_ANIMAL", "PESEE_CONTROL"],
    AUTRE: [],
  };
  const TYPES_ALERTE_FALLBACK = Object.values(TYPE_GROUPE).flat();

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet("/api/utilisateur/permissions/catalogue");
        // Nouvelle forme : { catalogue, modelesPermissions, ... } | Ancienne : tableau plat
        const cat = Array.isArray(d) ? d : (d.catalogue ?? []);
        setCatalogue(cat);
        setModelesPerms(Array.isArray(d) ? MODELES_PERMS_FALLBACK : (d.modelesPermissions ?? MODELES_PERMS_FALLBACK));
        setModelesNotifs(Array.isArray(d) ? MODELES_NOTIFS_FALLBACK : (d.modelesNotifications ?? MODELES_NOTIFS_FALLBACK));
        setTypesAlerte(Array.isArray(d) ? TYPES_ALERTE_FALLBACK : (d.typesAlerte ?? TYPES_ALERTE_FALLBACK));
      } catch (e) { setError(e.message); }
      finally { setChargement(false); }
    })();
  }, []);

  // Quand le rôle change (ou au chargement), on ré-applique le modèle
  useEffect(() => {
    const modele = modelesPerms[role] ?? {};
    const set = new Set();
    Object.entries(modele).forEach(([m, actions]) => actions.forEach((a) => set.add(cle(m, a))));
    setPermsAccordees(set);
    setNotifsActives(new Set(modelesNotifs[role] ?? []));
  }, [role, modelesPerms, modelesNotifs]);

  const modules = useMemo(() => [...new Set(catalogue.map((c) => c.module))], [catalogue]);
  const aCombinaison = (m, a) => catalogue.some((c) => c.module === m && c.action === a);

  const togglePerm = (m, a) => {
    setPermsAccordees((prev) => {
      const next = new Set(prev);
      const k = cle(m, a);
      if (next.has(k)) next.delete(k);
      else { next.add(k); if (a !== "LIRE") next.add(cle(m, "LIRE")); }
      return next;
    });
  };
  const toggleNotif = (t) => {
    setNotifsActives((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const canSubmit = nom.trim() && role && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
const permissions = catalogue.map((c) => ({
  module: c.module, action: c.action, accorde: permsAccordees.has(cle(c.module, c.action)),
})); // ← PAS de .filter : on envoie toute la matrice (accorde true ET false), comme à la modification
const notifications = typesAlerte.map((t) => ({ type_alerte: t, actif: notifsActives.has(t) }));

      // Le backend génère le mot de passe et renvoie { username, motDePasseTemporaire }
      const employe = await apiSend("/api/utilisateur", "POST", {
        nom: nom.trim(), telephone: telephone.trim() || null, role,
        permissions, notifications,
      });
      setCreee(employe); // username + motDePasseTemporaire (rendus une seule fois)
    } catch (e) { setError(e.message); setSaving(false); }
  };

  // ── Écran récapitulatif après création (identifiants copiables) ──
  if (creee) {
    return (
      <CompteCreeRecap
        compte={creee}
        role={role}
        onFermer={() => onSuccess?.(creee)}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><UserPlus size={18} /> Créer un utilisateur</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>
        <p className="modal-subtitle">
          Les permissions et notifications sont pré-cochées selon le rôle. Ajustez-les si besoin avant de créer.
        </p>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="cu-nom">Nom complet *</label>
            <input id="cu-nom" type="text" value={nom} autoFocus onChange={(e) => setNom(e.target.value)} placeholder="Ex : Youssef El Amrani" />
          </div>
          <div className="adv-field-row">
            <div className="adv-field">
              <label htmlFor="cu-tel">Téléphone</label>
              <input id="cu-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="adv-field">
              <label htmlFor="cu-role">Rôle *</label>
              <select id="cu-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="OPERATEUR">Opérateur</option>
                <option value="VETERINAIRE">Vétérinaire</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>
          <p className="modal-note">
            L'identifiant de connexion et un mot de passe temporaire seront générés automatiquement
            et affichés à la création, pour que vous les communiquiez à l'employé.
          </p>

          {/* Section permissions repliable */}
          <div className="collapse-section">
            <button type="button" className="collapse-header"
              onClick={() => setPermsOuvert((v) => !v)}>
              <ShieldCheck size={15} /> Permissions
              <span className="collapse-count">{permsAccordees.size} accordées</span>
            </button>
            {permsOuvert && chargement && (
              <p className="muted collapse-empty"><Loader2 size={14} className="spin" /> Chargement du catalogue…</p>
            )}
            {permsOuvert && !chargement && modules.length === 0 && (
              <p className="muted collapse-empty">Catalogue de permissions vide — vérifiez que la table module_permission est bien initialisée (15 lignes).</p>
            )}
            {permsOuvert && !chargement && modules.length > 0 && (
              <table className="matrice-table">
                <thead>
                  <tr><th>Module</th>{ACTIONS.map((a) => <th key={a}>{ACTION_LABEL[a]}</th>)}</tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m}>
                      <td className="matrice-module">{MODULE_LABEL[m] ?? m}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="matrice-cell">
                          {aCombinaison(m, a)
                            ? <Toggle
                                checked={permsAccordees.has(cle(m, a))}
                                disabled={a === "LIRE" && (permsAccordees.has(cle(m, "ECRIRE")) || permsAccordees.has(cle(m, "SUPPRIMER")))}
                                onChange={() => togglePerm(m, a)}
                              />
                            : <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section notifications repliable */}
          <div className="collapse-section">
            <button type="button" className="collapse-header"
              onClick={() => setNotifsOuvert((v) => !v)}>
              <Bell size={15} /> Notifications
              <span className="collapse-count">{notifsActives.size} activées</span>
            </button>
            {notifsOuvert && !chargement && (
              <div className="notif-compact">
                {Object.entries(TYPE_GROUPE).map(([groupe, types]) => {
                  const visibles = types.filter((t) => typesAlerte.includes(t));
                  if (visibles.length === 0) return null;
                  return (
                    <div key={groupe} className="notif-groupe">
                      <h3 className="notif-groupe-titre">{groupe}</h3>
                      {visibles.map((t) => (
                        <label key={t} className="notif-ligne">
                          <span>{TYPE_ALERTE_LABEL[t] ?? t}</span>
                          <Toggle checked={notifsActives.has(t)} onChange={() => toggleNotif(t)} />
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Création…</> : "Créer le compte"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────── Récap après création (identifiants copiables) ───────────────────── */

function CompteCreeRecap({ compte, role, onFermer }) {
  const [copie, setCopie] = useState(false);

  const texteStructure = [
    "═══════════════════════════════",
    "  IDENTIFIANTS DE CONNEXION — Ovinéa",
    "═══════════════════════════════",
    "",
    `Nom          : ${compte.nom}`,
    `Rôle         : ${ROLE_LABEL[role] ?? role}`,
    `Identifiant  : ${compte.username}`,
    compte.telephone ? `Téléphone    : ${compte.telephone}` : null,
    `Mot de passe : ${compte.motDePasseTemporaire}`,
    "",
    "Connexion : choisissez « Employé » puis saisissez l'identifiant.",
    "Le mot de passe devra être changé à la première connexion.",
    "═══════════════════════════════",
  ].filter(Boolean).join("\n");

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteStructure);
      setCopie(true); setTimeout(() => setCopie(false), 2000);
    } catch { /* clipboard indisponible */ }
  };

  return (
    <div className="modal-overlay" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Check size={18} /> Compte créé</h2>
          <button className="icon-btn-small" onClick={onFermer}><X size={16} /></button>
        </header>
        <p className="modal-subtitle">
          Communiquez ces identifiants à <strong>{compte.nom}</strong>.
          <strong> Le mot de passe ne sera plus jamais affiché</strong> après fermeture.
        </p>

        <div className="modal-body">
          <div className="recap-card">
            <div className="recap-ligne"><span>Nom</span><strong>{compte.nom}</strong></div>
            <div className="recap-ligne"><span>Rôle</span><strong>{ROLE_LABEL[role] ?? role}</strong></div>
            <div className="recap-ligne"><span>Identifiant</span><strong>{compte.username}</strong></div>
            {compte.telephone && (
              <div className="recap-ligne"><span>Téléphone</span><strong>{compte.telephone}</strong></div>
            )}
            <div className="recap-ligne recap-mdp">
              <span>Mot de passe</span><strong>{compte.motDePasseTemporaire}</strong>
            </div>
          </div>
          <button className={`btn-copy${copie ? " is-copied" : ""}`} onClick={copier}>
            {copie ? <><Check size={15} /> Copié dans le presse-papier</> : <><Copy size={15} /> Copier les identifiants</>}
          </button>
        </div>

        <footer className="modal-footer">
          <button className="btn-primary" onClick={onFermer}>Terminé</button>
        </footer>
      </div>
    </div>
  );
}



function MonProfil() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try { setData(await apiGet("/api/utilisateur/mon-profil")); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement…</p></div>;
  if (error) return <div className="table-state is-error"><ServerCrash size={28} /><p>{error}</p></div>;

  const permsAccordees = (data.permissions ?? []).filter((p) => p.accorde);
  const notifsActives = (data.notifications ?? []).filter((n) => n.actif);

  return (
    <div className="utilisateurs-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mon compte</p>
          <h1 className="page-title"><Users size={22} /> {data.nom}</h1>
          <p className="page-subtitle">{ROLE_LABEL[data.role] ?? data.role} · {data.username ?? data.email ?? "—"}</p>
        </div>
      </header>

      <section className="profil-bloc">
        <h3 className="notif-groupe-titre"><ShieldCheck size={15} /> Mes accès</h3>
        {permsAccordees.length === 0
          ? <p className="muted">Aucune permission accordée. Contactez l'administrateur de la ferme.</p>
          : (
            <ul className="profil-liste">
              {permsAccordees.map((p) => (
                <li key={`${p.module}:${p.action}`}>
                  {MODULE_LABEL[p.module] ?? p.module} — {ACTION_LABEL[p.action] ?? p.action}
                </li>
              ))}
            </ul>
          )}
        <p className="muted profil-note">Vos accès sont définis par l'administrateur de la ferme.</p>
      </section>

      <section className="profil-bloc">
        <h3 className="notif-groupe-titre"><Bell size={15} /> Mes notifications</h3>
        {notifsActives.length === 0
          ? <p className="muted">Aucune notification activée.</p>
          : (
            <ul className="profil-liste">
              {notifsActives.map((n) => (
                <li key={n.type_alerte}>{TYPE_ALERTE_LABEL[n.type_alerte] ?? n.type_alerte}</li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}