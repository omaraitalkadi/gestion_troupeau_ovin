import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Syringe, Loader2, ServerCrash, RefreshCw, Users, Pill,
} from "lucide-react";
import "./sante.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const STATUT_LABEL = {
  PROGRAMMEE: "Programmée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée",
  EN_ATTENTE: "En attente", REALISEE: "Réalisée", REPORTEE: "Reportée",
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function useCampagne(id) {
  const [campagne, setCampagne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIt = useCallback(async () => {
    if (!id) { setLoading(false); setError("Identifiant de campagne manquant dans l'URL."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/compagne/${id}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/sante/compagne/:id montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      if (!json.data) throw new Error("Réponse 200 sans données.");
      setCampagne(json.data);
    } catch (e) {
      setError(e.message); setCampagne(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIt(); }, [fetchIt]);
  return { campagne, loading, error, refetch: fetchIt };
}

export default function CampagneVaccinationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campagne, loading, error, refetch } = useCampagne(id);

  const vaccinations = campagne?.vaccinations ?? [];
  const nomAnimal = (v) => {
    const a = v.dossier_medical?.animaux;
    return a?.numero_rfid ?? a?.numero_legal ?? "—";
  };

  return (
    <div className="medicament-detail-page">
      <header className="page-header">
        <div>
          <button className="link" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Retour</button>
          <p className="eyebrow">Santé · Vaccination</p>
          <h1 className="page-title"><Syringe size={22} /> {loading ? "Chargement…" : campagne?.nom ?? "Campagne"}</h1>
          {campagne && (
            <p className="page-subtitle">
              {STATUT_LABEL[campagne.statut] ?? campagne.statut}
              {campagne.medicament && ` · ${campagne.medicament.nom_commercial}`}
            </p>
          )}
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={refetch} disabled={loading} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </header>

      {loading && <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement…</p></div>}

      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} /><p>{error}</p>
          <button className="btn-secondary" onClick={refetch}><RefreshCw size={14} /> Réessayer</button>
        </div>
      )}

      {!loading && !error && campagne && (
        <>
          <div className="detail-cards">
            <div className="detail-card">
              <span className="detail-label">Statut</span>
              <span className="detail-value">{STATUT_LABEL[campagne.statut] ?? campagne.statut}</span>
            </div>
            <div className="detail-card">
              <span className="detail-label"><Pill size={12} /> Vaccin</span>
              <span className="detail-value" style={{ fontSize: "1.05rem" }}>
                {campagne.medicament?.nom_commercial ?? "—"}
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-label">Période prévue</span>
              <span className="detail-value" style={{ fontSize: "1.05rem" }}>
                {fmtDate(campagne.date_debut_prevue)} → {fmtDate(campagne.date_fin_prevue)}
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-label"><Users size={12} /> Animaux inclus</span>
              <span className="detail-value">{vaccinations.length}</span>
            </div>
          </div>

          {campagne.description && (
            <p className="muted" style={{ maxWidth: "70ch" }}>{campagne.description}</p>
          )}

          <div className="table-wrap">
            <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Animaux de la campagne</span>
              <span className="badge badge-muted">{vaccinations.length}</span>
            </div>
            {campagne.vaccinations_error ? (
              <div className="empty-state">
                <p>Impossible d'afficher le détail des animaux ({campagne.vaccinations_error}).</p>
              </div>
            ) : vaccinations.length === 0 ? (
              <div className="empty-state"><p>Aucun animal inclus dans cette campagne.</p></div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Animal</th><th>Date prévue</th><th>Statut</th></tr></thead>
                <tbody>
                  {vaccinations.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: "monospace" }}>{nomAnimal(v)}</td>
                      <td>{fmtDate(v.date_prevue)}</td>
                      <td><span className="badge badge-muted">{STATUT_LABEL[v.statut] ?? v.statut}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}