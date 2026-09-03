import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Wheat, Plus, ArrowRight, Layers, Mars, Venus, Wallet, Sigma,
  Loader2, RefreshCw, Baby, HeartPulse, Syringe, TrendingUp, TrendingDown, Users,
} from "lucide-react";
import "./dashboard-lots.css";
import NouvelAnimalModal from "./NouvelAnimalModal.jsx";

const API_BASE = document.location.origin || "http://localhost";

const fmtMAD = (n) =>
  `${Number(n ?? 0).toLocaleString("fr-MA", { maximumFractionDigits: 0 })} DH`;

function mediane(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const maleOf = (l) => l.maleCount ?? l.males ?? l.beliers ?? 0;
const femaleOf = (l) => l.femaleCount ?? l.females ?? l.brebis ?? 0;

export default function Dashboard() {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── /me : ferme + user + lots ──
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnimalForm, setShowAnimalForm] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/utilisateur/me`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDash(await res.json());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── /api/dashboard : stats agrégées (animaux, repro, santé, finance) ──
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true); setStatsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard`, { credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/dashboard montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setStats(json.data ?? json);
    } catch (e) { setStatsError(e.message); }
    finally { setStatsLoading(false); }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Consommation médiane par animal (mois glissant, tout le troupeau) ──
  const [conso, setConso] = useState(null);
  const [consoLoading, setConsoLoading] = useState(true);
  const [consoError, setConsoError] = useState(null);

  const fetchConso = useCallback(async () => {
    setConsoLoading(true); setConsoError(null);
    try {
      const res = await fetch(`${API_BASE}/api/alimentation/consommations`, { credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/alimentation/consommations montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      const parAnimal = new Map();
      for (const c of json.data ?? []) {
        const cout = Number(c.quantite) * Number(c.cout_unitaire ?? 0);
        if (!Number.isFinite(cout)) continue;
        parAnimal.set(c.animal_id, (parAnimal.get(c.animal_id) ?? 0) + cout);
      }
      setConso({ medianeParAnimal: mediane([...parAnimal.values()]) });
    } catch (e) { setConsoError(e.message); }
    finally { setConsoLoading(false); }
  }, []);
  useEffect(() => { fetchConso(); }, [fetchConso]);

  const ferme = dash?.ferme;
  const user = dash?.user;
  const lots = dash?.lots ?? [];

  const a = stats?.animaux;
  const repro = stats?.reproduction;
  const sante = stats?.sante;
  const finance = stats?.finance;

  return (
    <div className="dashboard">
      {/* ── En-tête ── */}
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Tableau de bord</p>
          <h1 className="page-title">{loading ? "Chargement…" : ferme?.nom ?? "Aucune ferme"}</h1>
          <p className="page-subtitle">{user ? user.nom : error ? "Données indisponibles" : "—"}</p>
          <p className="page-subtitle page-subtitle--muted">{today}</p>
        </div>
        <button type="button" className="btn-nouvel-animal" onClick={() => setShowAnimalForm(true)}>
          <Plus size={18} strokeWidth={2} /> Nouvel animal
        </button>
      </header>

      {/* ── KPIs (données réelles) ── */}
      <section className="stat-grid">
        <StatCard icon={<Users size={16} />} label="Effectif total"
          value={a?.total} loading={statsLoading} error={statsError} />
        <StatCard icon={<TrendingUp size={16} />} label="Actifs"
          value={a?.actif} loading={statsLoading} error={statsError} tone="ok" />
        <StatCard icon={<Wallet size={16} />} label="Vendus"
          value={a?.vendu} loading={statsLoading} error={statsError} />
        <StatCard icon={<TrendingDown size={16} />} label="Morts"
          value={a?.mort} loading={statsLoading} error={statsError} tone="danger" />
        <StatCard icon={<HeartPulse size={16} />} label="En quarantaine"
          value={a?.quarantaine} loading={statsLoading} error={statsError} tone="warn" />
      </section>

      {/* ── Reproduction + Santé (données réelles) ── */}
      <section className="stat-grid">
        <StatCard icon={<Baby size={16} />} label="Gestations en cours"
          value={repro?.gestations_en_cours} loading={statsLoading} error={statsError} hint="brebis gestantes" />
        <StatCard icon={<Baby size={16} />} label="Gestations ce mois"
          value={repro?.gestations_ce_mois} loading={statsLoading} error={statsError} hint="débutées" />
        <StatCard icon={<Baby size={16} />} label="Naissances ce mois"
          value={repro?.naissances_ce_mois} loading={statsLoading} error={statsError} hint="agneaux" />
        <StatCard icon={<Syringe size={16} />} label="Vaccinations dues"
          value={sante?.vaccinations_dues} loading={statsLoading} error={statsError}
          tone={sante?.vaccinations_dues > 0 ? "warn" : undefined} hint="à faire" />
      </section>

      {/* ── Mes lots (depuis /me) ── */}
      <section className="card lots-card">
        <div className="card-head">
          <h2><Layers size={16} /> Mes lots</h2>
          <Link to="/troupeau" className="link">Tout le troupeau <ArrowRight size={14} /></Link>
        </div>

        {loading && <p className="lots-state">Chargement des lots…</p>}
        {error && !loading && <p className="lots-state lots-state--error">Impossible de charger les lots ({error}).</p>}
        {!loading && !error && lots.length === 0 && <p className="lots-state">Aucun lot pour cette ferme.</p>}

        {lots.length > 0 && (
          <div className="lots-grid">
            {lots.map((lot) => {
              const males = maleOf(lot);
              const females = femaleOf(lot);
              const count = lot.animalCount ?? males + females;
              return (
                <Link key={lot.id} to={`/lots/${lot.id}`} className="lot-card" data-type={lot.type}>
                  <div className="lot-card-top">
                    <span className="lot-name">{lot.nom}</span>
                    {lot.type && <span className="lot-badge">{lot.type}</span>}
                  </div>
                  <div className="lot-total">
                    🐑<span className="lot-total-value">{count}</span>
                    <span className="lot-total-label">{count > 1 ? "animaux" : "animal"}</span>
                  </div>
                  <div className="lot-gender">
                    <div className="lot-gender-cell lot-gender-cell--male">
                      <Mars size={16} /><span className="lot-gender-count">{males}</span><span className="lot-gender-label">Mâles</span>
                    </div>
                    <div className="lot-gender-cell lot-gender-cell--female">
                      <Venus size={16} /><span className="lot-gender-count">{females}</span><span className="lot-gender-label">Femelles</span>
                    </div>
                  </div>
                  <GenderBar male={males} female={females} />
                  <div className="lot-races">
                    {lot.races?.length
                      ? lot.races.map((r) => <span key={r} className="race-chip">{r}</span>)
                      : <span className="lot-empty">Aucune race renseignée</span>}
                  </div>
                  <span className="lot-cta">Voir les animaux <ArrowRight size={14} /></span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Finance + Consommation ── */}
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2><Wallet size={16} /> Finance de la ferme</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" className="link" onClick={fetchStats} disabled={statsLoading}
                style={{ background: "none", border: "none", cursor: "pointer" }} title="Rafraîchir">
                <RefreshCw size={14} className={statsLoading ? "spin" : ""} />
              </button>
              <Link to="/finance" className="link">Détails <ArrowRight size={14} /></Link>
            </div>
          </div>

          {statsLoading && <p className="lots-state" style={{ display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={16} className="spin" /> Chargement…</p>}
          {statsError && !statsLoading && <p className="lots-state lots-state--error">Indisponible ({statsError}).</p>}
          {!statsLoading && !statsError && finance && (
            <div className="finance-rows">
              <div className="finance-row">
                <span className="finance-label"><TrendingDown size={13} /> Dépenses</span>
                <span className="finance-value finance-value--sm">{fmtMAD(finance.depenses_total)}</span>
              </div>
              <div className="finance-row">
                <span className="finance-label"><TrendingUp size={13} /> Revenus</span>
                <span className="finance-value finance-value--sm">{fmtMAD(finance.revenus_total)}</span>
              </div>
              <div className="finance-row finance-row--total">
                <span className="finance-label"><Sigma size={13} /> Solde</span>
                <span className={`finance-value finance-value--sm ${finance.solde < 0 ? "is-neg" : "is-pos"}`}>
                  {fmtMAD(finance.solde)}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2><Wheat size={16} /> Consommation alimentaire</h2>
            <button type="button" className="link" onClick={fetchConso} disabled={consoLoading}
              style={{ background: "none", border: "none", cursor: "pointer" }} title="Rafraîchir">
              <RefreshCw size={14} className={consoLoading ? "spin" : ""} />
            </button>
          </div>

          {consoLoading && <p className="lots-state" style={{ display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={16} className="spin" /> Chargement…</p>}
          {consoError && !consoLoading && <p className="lots-state lots-state--error">Indisponible ({consoError}).</p>}
          {!consoLoading && !consoError && conso && (
            <div>
              <div className="finance-label"><Sigma size={13} /> Consommation médiane / animal</div>
              <div className="finance-value">{fmtMAD(conso.medianeParAnimal)}</div>
              <div className="kpi-hint">troupeau entier · 30 j</div>
            </div>
          )}
        </section>
      </div>

      {showAnimalForm && (
        <NouvelAnimalModal
          lots={lots}
          fermeId={ferme?.id}
          onClose={() => setShowAnimalForm(false)}
          onCreated={() => { fetchDashboard(); fetchStats(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, loading, error, tone }) {
  return (
    <div className={`stat-card${tone ? ` stat-card--${tone}` : ""}`}>
      <div className="stat-card-head">{icon}<span>{label}</span></div>
      <div className="stat-card-value">
        {loading ? <Loader2 size={18} className="spin" /> : error ? "—" : (value ?? 0)}
      </div>
      {hint && !loading && !error && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}

function GenderBar({ male = 0, female = 0 }) {
  const total = male + female;
  if (!total) return null;
  const malePct = (male / total) * 100;
  return (
    <div className="gender-bar" title={`${male} mâle(s) · ${female} femelle(s)`}>
      <span className="gender-bar-male" style={{ width: `${malePct}%` }} />
      <span className="gender-bar-female" style={{ width: `${100 - malePct}%` }} />
    </div>
  );
}