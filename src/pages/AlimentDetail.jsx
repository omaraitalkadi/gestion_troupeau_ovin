import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, PackagePlus, X, Loader2, ServerCrash,
  RefreshCw, Wheat, Coins,
} from "lucide-react";
import "./aliment-detail.css";
const TYPE_LABEL = {
  FOURRAGE:         "Fourrage",
  CONCENTRE:        "Concentré",
  CEREALE:          "Céréale",
  MINERAL_VITAMINE: "Minéral / Vitamine",
};

const fmtMAD = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(n);

// ─── Hook de chargement de l'aliment ─────────────────────────
function useAliment(id) {
  const [aliment, setAliment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAliment = useCallback(async () => {
    // Garde-fou : un id manquant (route mal déclarée) est une erreur explicite,
    // pas un chargement infini.
    if (!id) {
      setLoading(false);
      setError("Aucun identifiant d'aliment dans l'URL. Vérifie la route (/alimentation/aliments/:id).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/alimentation/aliments/${id}`);
      const contentType = res.headers.get("content-type") || "";

      // Réponse non-JSON = route non montée (le catch-all SPA renvoie du HTML)
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Réponse non-JSON (status ${res.status}). La route GET /api/alimentation/aliment/:id ` +
          `est-elle bien montée côté Express ?`
        );
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      // Réponse OK mais sans données = mauvaise forme, ligne absente ou RLS bloquante
      if (!json.data) {
        throw new Error(
          "Le serveur a répondu 200 mais sans aliment. Attendu { data: {...} }. " +
          "Vérifie la forme de la réponse et les policies RLS de la table aliments."
        );
      }

      setAliment(json.data);
    } catch (err) {
      setError(err.message);
      setAliment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAliment(); }, [fetchAliment]);

  return { aliment, loading, error, refetch: fetchAliment };
}

// ─── Page ────────────────────────────────────────────────────
export default function AlimentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { aliment, loading, error, refetch } = useAliment(id);
  const [showAchat, setShowAchat] = useState(false);

  return (
    <div className="aliment-detail-page">
      <header className="page-header">
        <div>
          <button className="link" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Retour
          </button>
          <p className="eyebrow">Alimentation · Stock</p>
          <h1 className="page-title">
            <Wheat size={22} /> {loading ? "Chargement…" : aliment?.nom ?? "Aliment"}
          </h1>
          {aliment && (
            <p className="page-subtitle">
              {TYPE_LABEL[aliment.type] ?? aliment.type}
            </p>
          )}
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={refetch} disabled={loading} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowAchat(true)}
            disabled={loading || !aliment}
          >
            <PackagePlus size={16} /> Ajouter au stock
          </button>
        </div>
      </header>

      {loading && (
        <div className="table-state">
          <Loader2 size={28} className="spin" />
          <p>Chargement de l'aliment…</p>
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

      {!loading && !error && aliment && (
        <div className="detail-cards">
          <div className="detail-card">
            <span className="detail-label">Stock actuel</span>
            <span className="detail-value">
              {Number(aliment.quantite_stock ?? 0).toLocaleString("fr-MA")} {aliment.unite_mesure ?? "kg"}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Type</span>
            <span className="detail-value">{TYPE_LABEL[aliment.type] ?? aliment.type ?? "—"}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Coût unitaire </span>
            <span className="detail-value">
              {aliment.cout_unitaire != null ? `${fmtMAD(aliment.cout_unitaire)}/kg` : "—"}
            </span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Valeur du stock</span>
            <span className="detail-value">
              {aliment.cout_unitaire != null
                ? fmtMAD(Number(aliment.quantite_stock ?? 0) * Number(aliment.cout_unitaire))
                : "—"}
            </span>
          </div>
        </div>
      )}

      {showAchat && aliment && (
        <AchatAlimentModal
          aliment={aliment}
          onClose={() => setShowAchat(false)}
          onSuccess={() => { setShowAchat(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Modal d'achat / entrée en stock ─────────────────────────
function AchatAlimentModal({ aliment, onClose, onSuccess }) {
  const [quantite,    setQuantite]    = useState("");
  const [montant,     setMontant]     = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Garde-fou contre le piège Number("") === 0 : on valide la présence
  // de la saisie AVANT toute conversion numérique.
  const qteNum     = quantite.trim() === "" ? NaN : Number(quantite);
  const montantNum = montant.trim()  === "" ? NaN : Number(montant);

  const qteValide     = Number.isFinite(qteNum)     && qteNum > 0;
  const montantValide = Number.isFinite(montantNum) && montantNum >= 0;
  const canSubmit = qteValide && montantValide && !saving;

  const prixUnitaire = qteValide && montantValide ? montantNum / qteNum : null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/achat/aliment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aliment_id: aliment.id,
          quantite: qteNum,
          montant: montantNum,
          description: description.trim() || null,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Le serveur n'a pas renvoyé du JSON (status ${res.status}).`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onSuccess?.(json);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Coins size={18} /> Achat — {aliment.nom}</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="achat-qte">Quantité (kg) *</label>
            <input
              id="achat-qte"
              type="number"
              min="0"
              step="any"
              placeholder="Ex : 500"
              value={quantite}
              autoFocus
              onChange={(e) => setQuantite(e.target.value)}
            />
          </div>

          <div className="adv-field">
            <label htmlFor="achat-montant">Prix total de l'achat (MAD) *</label>
            <input
              id="achat-montant"
              type="number"
              min="0"
              step="any"
              placeholder="Ex : 1750"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
          </div>

          <div className="adv-field">
            <label htmlFor="achat-desc">Description (optionnel)</label>
            <input
              id="achat-desc"
              type="text"
              placeholder="Ex : Coopérative Doukkala, livraison camion"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {prixUnitaire != null && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Prix unitaire de cet achat : <strong>{fmtMAD(prixUnitaire)}/kg</strong>
            </p>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Enregistrement…</> : "Enregistrer l'achat"}
          </button>
        </footer>
      </div>
    </div>
  );
}