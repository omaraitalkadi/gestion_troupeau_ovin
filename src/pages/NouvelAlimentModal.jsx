import { useState } from "react";
import { X, Loader2, Wheat } from "lucide-react";

// Valeurs alignées sur l'enum TypeAliment du diagramme de classes
const TYPES_ALIMENT = [
  { value: "FOURRAGE",         label: "Fourrage (foin, paille)" },
  { value: "CONCENTRE",        label: "Concentré (granulés, composés)" },
  { value: "CEREALE",          label: "Céréale (orge, maïs)" },
  { value: "MINERAL_VITAMINE", label: "Minéral / Vitamine (CMV, blocs)" },
];

/**
 * Modal de création d'un aliment.
 * - `nom` et `type` obligatoires ; `seuil_alerte_stock` optionnel (NULL = fallback 20% côté serveur).
 * - Le stock démarre à 0 (imposé côté serveur).
 * - En cas de succès, appelle onCreated(aliment) — le parent gère la navigation.
 */
export default function NouvelAlimentModal({ onClose, onCreated }) {
  const [nom,   setNom]   = useState("");
  const [type,  setType]  = useState("");
  const [seuil, setSeuil] = useState("");        // string : champ vide = pas de seuil
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const seuilValide = seuil === "" || (Number(seuil) >= 0 && Number.isFinite(Number(seuil)));
  const canSubmit = nom.trim().length > 0 && type !== "" && seuilValide && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alimentation/aliment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          type,
          seuil: seuil === "" ? null : Number(seuil),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Le serveur n'a pas renvoyé du JSON (status ${res.status}).`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      onCreated?.(json.data);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Wheat size={18} /> Nouvel aliment</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}>
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="aliment-nom">Nom *</label>
            <input
              id="aliment-nom"
              type="text"
              placeholder="Ex : Orge concassée"
              value={nom}
              autoFocus
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="adv-field">
            <label htmlFor="aliment-type">Type *</label>
            <select
              id="aliment-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="" disabled>— Choisir un type —</option>
              {TYPES_ALIMENT.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="adv-field">
            <label htmlFor="aliment-seuil">Seuil d'alerte de stock (kg)</label>
            <input
              id="aliment-seuil"
              type="number"
              min="0"
              step="0.001"
              placeholder="Ex : 50"
              value={seuil}
              onChange={(e) => setSeuil(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <p className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Une alerte sera créée quand le stock passera sous ce seuil.
              Laisser vide pour un seuil automatique (20 % du stock).
            </p>
          </div>

          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Le stock initial sera de <strong>0 kg</strong>. Vous pourrez l'alimenter
            depuis la fiche de l'aliment via un achat.
          </p>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Création…</> : "Créer l'aliment"}
          </button>
        </footer>
      </div>
    </div>
  );
}