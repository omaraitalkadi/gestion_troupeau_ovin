import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Wheat, ClipboardList, Loader2, ServerCrash, RefreshCw,
  Package, Coins, Layers, ArrowRight, Plus,
} from "lucide-react";
import "./Alimentation.css";
import NouvelAlimentModal from "./NouvelAlimentModal.jsx";
import NouveauPlanAlimentaireModal from "./NouveauPlanAlimentaireModal.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const TYPE_LABEL = {
  FOURRAGE: "Fourrage",
  CONCENTRE: "Concentré",
  CEREALE: "Céréale",
  MINERAL_VITAMINE: "Minéral / Vitamine",
};

const fmtMAD = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(n);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);

// Les deux endpoints ne renvoient pas la même forme :
//   /aliments -> { data: [...] }   |   /plans -> [...] (tableau nu)
const unwrap = (json) => (Array.isArray(json) ? json : (json?.data ?? []));

// ─── Hook de fetch générique ─────────────────────────────────
function useResource(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route ${path} montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setItems(unwrap(json));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { fetchIt(); }, [fetchIt]);
  return { items, loading, error, refetch: fetchIt };
}

// ─── Page ────────────────────────────────────────────────────
export default function AlimentPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("aliments");
  const [modal, setModal] = useState(null); // "aliment" | "plan" | null

  const aliments = useResource("/api/alimentation/aliments");
  const plans = useResource("/api/alimentation/plans");

  const active = tab === "aliments" ? aliments : plans;

  return (
    <div className="alimentation-page">
      <header className="ali-header">
        <div>
          <p className="eyebrow">Alimentation</p>
          <h1 className="page-title"><Wheat size={22} /> Aliments &amp; plans</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-secondary" onClick={() => setModal("aliment")}>
            <Plus size={15} /> Nouvel aliment
          </button>
          <button className="btn-primary" onClick={() => setModal("plan")}>
            <Plus size={15} /> Nouveau plan
          </button>
          <button
            className="btn-secondary"
            onClick={active.refetch}
            disabled={active.loading}
            title="Rafraîchir"
          >
            <RefreshCw size={16} className={active.loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      {/* Toggle segmenté */}
      <div className="seg" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "aliments"}
          className={tab === "aliments" ? "is-active" : ""}
          onClick={() => setTab("aliments")}
        >
          <Package size={15} /> Aliments
          {!aliments.loading && !aliments.error && (
            <span className="seg-count">{aliments.items.length}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === "plans"}
          className={tab === "plans" ? "is-active" : ""}
          onClick={() => setTab("plans")}
        >
          <ClipboardList size={15} /> Plans alimentaires
          {!plans.loading && !plans.error && (
            <span className="seg-count">{plans.items.length}</span>
          )}
        </button>
      </div>

      {/* États */}
      {active.loading && (
        <div className="table-state">
          <Loader2 size={26} className="spin" />
          <p>Chargement…</p>
        </div>
      )}
      {!active.loading && active.error && (
        <div className="table-state is-error">
          <ServerCrash size={26} />
          <p>{active.error}</p>
          <button className="btn-secondary" onClick={active.refetch}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      )}

      {/* Contenu */}
      {!active.loading && !active.error && (
        tab === "aliments"
          ? <AlimentsGrid items={aliments.items} />
          : <PlansGrid items={plans.items} />
      )}

      {/* Modales de création */}
      {modal === "aliment" && (
        <NouvelAlimentModal
          onClose={() => setModal(null)}
          onCreated={(aliment) => {
            setModal(null);
            navigate(`/alimentation/aliments/${aliment.id}`);
          }}
        />
      )}
      {modal === "plan" && (
        <NouveauPlanAlimentaireModal
          onClose={() => setModal(null)}
          onCreated={(plan) => {
            setModal(null);
            navigate(
              plan.lot_id
                ? `/alimentation/plans/${plan.id}?lot=${plan.lot_id}`
                : `/alimentation/plans/${plan.id}`
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Section Aliments ────────────────────────────────────────
function AlimentsGrid({ items }) {
  if (items.length === 0)
    return <div className="ali-empty"><Package size={26} /><p>Aucun aliment enregistré.</p></div>;

  return (
    <div className="ali-grid">
      {items.map((a) => (
        <Link key={a.id} to={`/alimentation/aliments/${a.id}`} className="ali-card">
          <div className="ali-card-top">
            <span className="ali-card-name">{a.nom}</span>
            {a.type && <span className="badge badge-muted">{TYPE_LABEL[a.type] ?? a.type}</span>}
          </div>
          <div className="ali-card-stats">
            <span><Package size={13} /> {Number(a.quantite_stock ?? 0).toLocaleString("fr-MA")} kg</span>
            <span><Coins size={13} /> {a.cout_unitaire != null ? `${fmtMAD(a.cout_unitaire)}/kg` : "—"}</span>
          </div>
          <span className="ali-card-cta">Voir la fiche <ArrowRight size={13} /></span>
        </Link>
      ))}
    </div>
  );
}

// ─── Section Plans ───────────────────────────────────────────
function PlansGrid({ items }) {
  if (items.length === 0)
    return <div className="ali-empty"><ClipboardList size={26} /><p>Aucun plan alimentaire.</p></div>;

  return (
    <div className="ali-grid">
      {items.map((p) => {
        // Si le plan connaît son lot, on le passe pour activer la distribution
        const to = p.lot_id
          ? `/alimentation/plans/${p.id}?lot=${p.lot_id}`
          : `/alimentation/plans/${p.id}`;
        const debut = fmtDate(p.date_debut);
        const fin = fmtDate(p.date_fin);
        const nbLignes = p.lignes?.length ?? 0;
        return (
          <Link key={p.id} to={to} className="ali-card">
            <div className="ali-card-top">
              <span className="ali-card-name">{p.nom}</span>
              {p.lot_id && <span className="badge badge-muted"><Layers size={11} /> lot</span>}
            </div>
            {p.description && <p className="ali-card-desc">{p.description}</p>}
            <div className="ali-card-stats">
              <span><ClipboardList size={13} /> {nbLignes} aliment{nbLignes > 1 ? "s" : ""}</span>
              {(debut || fin) && (
                <span>{debut ?? "…"}{fin ? ` → ${fin}` : ""}</span>
              )}
            </div>
            <span className="ali-card-cta">Ouvrir le plan <ArrowRight size={13} /></span>
          </Link>
        );
      })}
    </div>
  );
}