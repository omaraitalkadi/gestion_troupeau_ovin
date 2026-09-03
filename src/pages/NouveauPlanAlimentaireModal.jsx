import { useState, useEffect } from "react";
import { X, Loader2, ClipboardList, Plus, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

/**
 * Modal de création d'un plan alimentaire.
 * Champs : nom, description, date_fin + lignes { aliment_id, quantite_kg_theorique_par_tete }.
 * En cas de succès, appelle onCreated(plan) — le parent gère la navigation.
 */
export default function NouveauPlanAlimentaireModal({ onClose, onCreated ,lot_id}) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [dateFin, setDateFin] = useState("");
  // chaque ligne : { aliment_id, quantite } (quantite en string pour la saisie)
  const [lignes, setLignes] = useState([{ aliment_id: "", quantite: "" }]);

  const [aliments, setAliments] = useState([]);
  const [loadingAliments, setLoadingAliments] = useState(true);
  const [alimentsError, setAlimentsError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── Chargement des aliments disponibles ──────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/alimentation/aliments`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json"))
          throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/alimentation/aliment montée ?`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) setAliments(json.data ?? []);
      } catch (e) {
        if (alive) setAlimentsError(e.message);
      } finally {
        if (alive) setLoadingAliments(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Manipulation des lignes ──────────────────────────────
  const setLigne = (i, patch) =>
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLigne = () => setLignes((prev) => [...prev, { aliment_id: "", quantite: "" }]);
  const removeLigne = (i) =>
    setLignes((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // aliments déjà choisis → on les grise dans les autres selects
  const dejaChoisis = new Set(lignes.map((l) => l.aliment_id).filter(Boolean));

  // ── Validation locale ────────────────────────────────────
  const lignesValides = lignes
    .map((l) => {
      const q = l.quantite.trim() === "" ? NaN : Number(l.quantite);
      return l.aliment_id && Number.isFinite(q) && q > 0
        ? { aliment_id: l.aliment_id, quantite_kg_theorique_par_tete: q }
        : null;
    })
    .filter(Boolean);

  const canSubmit =
    nom.trim().length > 0 && lignesValides.length === lignes.length && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      console.log(lot_id)
      const res = await fetch(`${API_BASE}/api/alimentation/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          description: description.trim() || null,
          date_fin: dateFin || null,
          lignes: lignesValides,
          
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Le serveur n'a pas renvoyé du JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onCreated?.(json.data);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "34rem" }}>
        <header className="modal-header">
          <h2><ClipboardList size={18} /> Nouveau plan alimentaire</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="plan-nom">Nom *</label>
            <input
              id="plan-nom"
              type="text"
              placeholder="Ex : Ration engraissement automne"
              value={nom}
              autoFocus
              onChange={(e) => setNom(e.target.value)}
            />
          </div>

          <div className="adv-field">
            <label htmlFor="plan-desc">Description</label>
            <textarea
              id="plan-desc"
              rows={2}
              placeholder="Composition, objectif, remarques…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="adv-field">
            <label htmlFor="plan-datefin">Date de fin</label>
            <input
              id="plan-datefin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>

          {/* ── Lignes d'aliments ── */}
          <div className="adv-field">
            <label>Aliments &amp; quantité par tête (kg/jour) *</label>

            {alimentsError && <p className="form-error">{alimentsError}</p>}
            {loadingAliments && (
              <p className="muted" style={{ fontSize: "0.82rem", display: "flex", gap: 6, alignItems: "center" }}>
                <Loader2 size={13} className="spin" /> Chargement des aliments…
              </p>
            )}
            {!loadingAliments && !alimentsError && aliments.length === 0 && (
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                Aucun aliment dans la ferme. Crée d'abord un aliment (bouton « Ajouter aliment »).
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lignes.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={l.aliment_id}
                    onChange={(e) => setLigne(i, { aliment_id: e.target.value })}
                    style={{ flex: 2 }}
                    disabled={loadingAliments || aliments.length === 0}
                  >
                    <option value="" disabled>— Aliment —</option>
                    {aliments.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={dejaChoisis.has(a.id) && l.aliment_id !== a.id}
                      >
                        {a.nom}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="kg/tête"
                    value={l.quantite}
                    onChange={(e) => setLigne(i, { quantite: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="icon-btn-small"
                    onClick={() => removeLigne(i)}
                    disabled={lignes.length === 1}
                    title="Retirer la ligne"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={addLigne}
              disabled={aliments.length === 0}
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              <Plus size={15} /> Ajouter un aliment
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Création…</> : "Créer le plan"}
          </button>
        </footer>
      </div>
    </div>
  );
}
