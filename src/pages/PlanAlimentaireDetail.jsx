import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ClipboardList, Loader2, ServerCrash, RefreshCw,
  Truck, X, CheckCircle2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

// ─── Hook : chargement du plan ───────────────────────────────
function usePlan(id) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlan = useCallback(async () => {
    if (!id) { setLoading(false); setError("Identifiant de plan manquant dans l'URL."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/alimentation/plans/${id}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/alimentation/plans/:id montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      if (!json.data) throw new Error("Réponse 200 sans données (forme attendue { data: {...} }).");
      setPlan(json.data);
    } catch (e) {
      setError(e.message); setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  return { plan, loading, error, refetch: fetchPlan };
}

// ─── Page ────────────────────────────────────────────────────
export default function PlanAlimentaireDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lotId = searchParams.get("lot"); // passé depuis la page du lot

  const { plan, loading, error, refetch } = usePlan(id);
  const [showDistrib, setShowDistrib] = useState(false);

  return (
    <div className="troupeau-page">
      <div className="detail-topbar">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <button
          className="btn-primary"
          onClick={() => setShowDistrib(true)}
          disabled={loading || !!error || !plan}
        >
          <Truck size={16} /> Distribuer aliment
        </button>
      </div>

      <div className="animal-hero">
        <div className="animal-avatar"><ClipboardList size={26} strokeWidth={1.5} /></div>
        <div className="animal-identity">
          <div className="eyebrow">Plan alimentaire</div>
          <h1 className="page-title" style={{ margin: "4px 0 8px" }}>
            {loading ? "…" : plan?.nom ?? "Plan"}
          </h1>
          <div className="animal-meta">
            {plan?.date_debut && <span className="muted">Début {fmtDate(plan.date_debut)}</span>}
            {plan?.date_fin && <span className="badge badge-muted">Fin {fmtDate(plan.date_fin)}</span>}
          </div>
          {plan?.description && (
            <p className="muted" style={{ margin: "8px 0 0", maxWidth: "60ch" }}>{plan.description}</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="table-state">
          <Loader2 size={28} className="spin" />
          <p>Chargement du plan…</p>
        </div>
      )}

      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} />
          <p>{error}</p>
          <button className="btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      )}

      {!loading && !error && plan && (
        <div className="table-wrap">
          <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Composition (par tête / jour)</span>
            <span className="badge badge-muted">{plan.lignes?.length ?? 0}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Aliment</th>
                <th>Type</th>
                <th>Quantité / tête</th>
                <th>Stock actuel</th>
              </tr>
            </thead>
            <tbody>
              {(plan.lignes ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.aliment?.nom ?? "—"}</td>
                  <td className="muted">{l.aliment?.type ?? "—"}</td>
                  <td>{l.quantite_kg_theorique_par_tete} kg</td>
                  <td>
                    {l.aliment?.quantite_stock != null
                      ? `${Number(l.aliment.quantite_stock).toLocaleString("fr-MA")} ${l.aliment.unite_mesure ?? "kg"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(plan.lignes ?? []).length === 0 && (
            <div className="empty-state"><p>Ce plan ne contient aucun aliment.</p></div>
          )}
        </div>
      )}

      {showDistrib && plan && (
        <DistributionModal
          plan={plan}
          defaultLotId={lotId}
          onClose={() => setShowDistrib(false)}
          onSuccess={() => { setShowDistrib(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Modal de distribution ───────────────────────────────────
function DistributionModal({ plan, defaultLotId, onClose, onSuccess }) {
  // Lots
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotsError, setLotsError] = useState(null);
  const [selectedLot, setSelectedLot] = useState(defaultLotId ?? "");

  // Animaux du lot sélectionné
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Charge la liste des lots (une seule fois)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lots?limit=500`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) setLots(json.data ?? []);
      } catch (e) {
        if (alive) setLotsError(e.message);
      } finally {
        if (alive) setLotsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Charge les animaux du lot sélectionné (rechargé à chaque changement)
  useEffect(() => {
    setSelected(new Set());
    setLoadError(null);
    if (!selectedLot) { setAnimals([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lots/${selectedLot}/animals?limit=1000`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) setAnimals(json.data ?? []);
      } catch (e) {
        if (alive) setLoadError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedLot]);

  const allSelected = animals.length > 0 && selected.size === animals.length;
  const toggle = (aid) =>
    setSelected((p) => { const n = new Set(p); n.has(aid) ? n.delete(aid) : n.add(aid); return n; });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(animals.map((a) => a.id)));

  const canSubmit = selected.size > 0 && !saving && !result;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/alimentation/distribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, lot_id: selectedLot, animal_ids: [...selected] }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Le serveur n'a pas renvoyé du JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setResult(json.data);
    } catch (e) {
      setError(e.message); setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "36rem" }}>
        <header className="modal-header">
          <h2><Truck size={18} /> Distribuer — {plan.nom}</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>

        <div className="modal-body">
          {/* Résultat de succès */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent-strong, #226047)", fontWeight: 600, margin: 0 }}>
                <CheckCircle2 size={18} /> Distribution enregistrée pour {result.nb_animaux} animal{result.nb_animaux > 1 ? "aux" : ""}.
              </p>
              <table className="data-table">
                <thead><tr><th>Aliment</th><th>Distribué</th><th>Stock restant</th></tr></thead>
                <tbody>
                  {result.details?.map((d) => (
                    <tr key={d.aliment_id}>
                      <td>{d.nom}</td>
                      <td>{d.total_distribue} kg</td>
                      <td>{d.stock_restant} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sélection du lot puis des animaux */}
          {!result && (
            <>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label htmlFor="distrib-lot" style={{ fontWeight: 500, display: "block", marginBottom: 6 }}>
                  Lot concerné
                </label>
                <select
                  id="distrib-lot"
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  disabled={lotsLoading || saving}
                  style={{ width: "100%" }}
                >
                  <option value="">— Choisir un lot —</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom ?? l.code ?? l.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                {lotsError && <p className="form-error">{lotsError}</p>}
              </div>

              {!selectedLot && !lotsLoading && (
                <p className="muted">Sélectionne un lot pour afficher ses animaux.</p>
              )}

              {loadError && <p className="form-error">{loadError}</p>}
              {loading && (
                <p className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Loader2 size={14} className="spin" /> Chargement des animaux du lot…
                </p>
              )}

              {selectedLot && !loading && !loadError && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, cursor: "pointer" }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      Tout sélectionner
                    </label>
                    <span className="badge badge-muted">{selected.size} / {animals.length}</span>
                  </div>

                  <div style={{ maxHeight: "40vh", overflowY: "auto", border: "1px solid var(--border, #e6e9ec)", borderRadius: 10 }}>
                    {animals.map((a) => (
                      <label
                        key={a.id}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                                 borderBottom: "1px solid var(--border, #eef0f1)", cursor: "pointer" }}
                      >
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                        <span style={{ fontFamily: "monospace" }}>{a.numero_rfid ?? a.numero_legal ?? a.id.slice(0, 8)}</span>
                        {a.race && <span className="muted" style={{ fontSize: "0.8rem" }}>{a.race}</span>}
                        {a.sexe && (
                          <span className={`sex-badge sex-${a.sexe}`} style={{ marginLeft: "auto" }}>
                            {a.sexe === "FEMELLE" ? "♀" : "♂"}
                          </span>
                        )}
                      </label>
                    ))}
                    {animals.length === 0 && (
                      <p className="muted" style={{ padding: 12, margin: 0 }}>Aucun animal dans ce lot.</p>
                    )}
                  </div>

                  <p className="muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
                    Chaque animal sélectionné consommera les quantités du plan ; le stock des aliments sera décrémenté.
                  </p>
                </>
              )}

              {error && <p className="form-error">{error}</p>}
            </>
          )}
        </div>

        <footer className="modal-footer">
          {result ? (
            <button className="btn-primary" onClick={onSuccess}>Terminé</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                {saving
                  ? <><Loader2 size={14} className="spin" /> Distribution…</>
                  : `Distribuer à ${selected.size} animal${selected.size > 1 ? "aux" : ""}`}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}