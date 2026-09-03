import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HeartPulse, Pill, Syringe, Loader2, ServerCrash, RefreshCw,
  Package, Coins, ArrowRight, Plus, CalendarClock,
} from "lucide-react";
import "./sante.css";
import NouveauMedicamentModal from "./NouveauMedicamentModal.jsx";
import NouvelleCampagneModal from "./NouvelleCampagneModal.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const CATEGORIE_LABEL = {
  VACCIN: "Vaccin", ANTIBIOTIQUE: "Antibiotique", ANTIPARASITAIRE: "Antiparasitaire",
  ANTI_INFLAMMATOIRE: "Anti-inflammatoire", VITAMINE_COMPLEMENT: "Vitamine / Complément",
};
const STATUT_LABEL = {
  PROGRAMMEE: "Programmée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée",
};
const fmtMAD = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(n);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);
const unwrap = (json) => (Array.isArray(json) ? json : (json?.data ?? []));

function useResource(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIt = useCallback(async () => {
    setLoading(true); setError(null);
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

export default function SantePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("medicaments");
  const [modal, setModal] = useState(null); // "medicament" | "campagne" | null

  const medicaments = useResource("/api/sante/medicaments");
  const campagnes = useResource("/api/sante/compagnes");
  const active = tab === "medicaments" ? medicaments : campagnes;

  return (
    <div className="sante-page">
      <header className="ali-header">
        <div>
          <p className="eyebrow">Santé &amp; Vaccination</p>
          <h1 className="page-title"><HeartPulse size={22} /> Pharmacie &amp; campagnes</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {tab === "medicaments" ? (
            <button className="btn-primary" onClick={() => setModal("medicament")}>
              <Plus size={15} /> Nouveau médicament
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setModal("campagne")}>
              <Plus size={15} /> Ajouter campagne de vaccination
            </button>
          )}
          <button className="btn-secondary" onClick={active.refetch} disabled={active.loading} title="Rafraîchir">
            <RefreshCw size={16} className={active.loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === "medicaments"}
          className={tab === "medicaments" ? "is-active" : ""} onClick={() => setTab("medicaments")}>
          <Pill size={15} /> Médicaments
          {!medicaments.loading && !medicaments.error && <span className="seg-count">{medicaments.items.length}</span>}
        </button>
        <button role="tab" aria-selected={tab === "campagnes"}
          className={tab === "campagnes" ? "is-active" : ""} onClick={() => setTab("campagnes")}>
          <Syringe size={15} /> Campagnes de vaccination
          {!campagnes.loading && !campagnes.error && <span className="seg-count">{campagnes.items.length}</span>}
        </button>
      </div>

      {active.loading && (
        <div className="table-state"><Loader2 size={26} className="spin" /><p>Chargement…</p></div>
      )}
      {!active.loading && active.error && (
        <div className="table-state is-error">
          <ServerCrash size={26} /><p>{active.error}</p>
          <button className="btn-secondary" onClick={active.refetch}><RefreshCw size={14} /> Réessayer</button>
        </div>
      )}

      {!active.loading && !active.error && (
        tab === "medicaments"
          ? <MedicamentsGrid items={medicaments.items} />
          : <CampagnesGrid items={campagnes.items} />
      )}

      {modal === "medicament" && (
        <NouveauMedicamentModal
          onClose={() => setModal(null)}
          onCreated={(med) => { setModal(null); navigate(`/sante/medicaments/${med.id}`); }}
        />
      )}
      {modal === "campagne" && (
        <NouvelleCampagneModal
          onClose={() => setModal(null)}
          onCreated={(camp) => { setModal(null); navigate(`/sante/campagnes/${camp.id}`); }}
        />
      )}
    </div>
  );
}

function MedicamentsGrid({ items }) {
  if (items.length === 0)
    return <div className="ali-empty"><Pill size={26} /><p>Aucun médicament enregistré.</p></div>;

  return (
    <div className="ali-grid">
      {items.map((m) => {
        const bas = m.seuil_alerte_stock != null &&
          Number(m.quantite_en_stock ?? 0) <= Number(m.seuil_alerte_stock);
        return (
          <Link key={m.id} to={`/sante/medicaments/${m.id}`} className="ali-card">
            <div className="ali-card-top">
              <span className="ali-card-name">{m.nom_commercial}</span>
              {m.categorie && <span className="badge badge-muted">{CATEGORIE_LABEL[m.categorie] ?? m.categorie}</span>}
            </div>
            <div className="ali-card-stats">
              <span className={bas ? "is-warning" : ""}>
                <Package size={13} /> {Number(m.quantite_en_stock ?? 0).toLocaleString("fr-MA")} {m.unite_mesure ?? ""}
                {bas && " · stock bas"}
              </span>
              <span><Coins size={13} /> {m.prix_unitaire != null ? `${fmtMAD(m.prix_unitaire)}/${m.unite_mesure ?? "u"}` : "—"}</span>
            </div>
            <span className="ali-card-cta">Voir la fiche <ArrowRight size={13} /></span>
          </Link>
        );
      })}
    </div>
  );
}

function CampagnesGrid({ items }) {
  if (items.length === 0)
    return <div className="ali-empty"><Syringe size={26} /><p>Aucune campagne de vaccination.</p></div>;

  return (
    <div className="ali-grid">
      {items.map((c) => {
        const debut = fmtDate(c.date_debut_prevue);
        const fin = fmtDate(c.date_fin_prevue);
        return (
          <Link key={c.id} to={`/sante/campagnes/${c.id}`} className="ali-card">
            <div className="ali-card-top">
              <span className="ali-card-name">{c.nom}</span>
              {c.statut && <span className={`badge statut-${c.statut}`}>{STATUT_LABEL[c.statut] ?? c.statut}</span>}
            </div>
            {c.description && <p className="ali-card-desc">{c.description}</p>}
            <div className="ali-card-stats">
              {(debut || fin) && (
                <span><CalendarClock size={13} /> {debut ?? "…"}{fin ? ` → ${fin}` : ""}</span>
              )}
              {c.cout != null && <span><Coins size={13} /> {fmtMAD(c.cout)}</span>}
            </div>
            <span className="ali-card-cta">Ouvrir la campagne <ArrowRight size={13} /></span>
          </Link>
        );
      })}
    </div>
  );
}