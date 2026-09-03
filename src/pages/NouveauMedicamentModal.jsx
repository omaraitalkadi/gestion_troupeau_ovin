import { useState } from "react";
import { X, Loader2, Pill } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const CATEGORIES = [
  { value: "VACCIN", label: "Vaccin" },
  { value: "ANTIBIOTIQUE", label: "Antibiotique" },
  { value: "ANTIPARASITAIRE", label: "Antiparasitaire" },
  { value: "ANTI_INFLAMMATOIRE", label: "Anti-inflammatoire" },
  { value: "VITAMINE_COMPLEMENT", label: "Vitamine / Complément" },
];
const VOIES = [
  { value: "INTRAMUSCULAIRE", label: "Intramusculaire" },
  { value: "SOUS_CUTANEE", label: "Sous-cutanée" },
  { value: "ORALE", label: "Orale" },
  { value: "TOPIQUE", label: "Topique" },
];
const UNITES = ["mg", "g", "mL", "L", "comprimé", "capsule", "flacon", "ampoule", "sachet", "tube", "dose", "unité"];

/**
 * Création d'un médicament. Le stock démarre à 0 (imposé serveur).
 * onCreated(medicament) → le parent gère la navigation vers la fiche.
 */
export default function NouveauMedicamentModal({ onClose, onCreated }) {
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [voie, setVoie] = useState("");
  const [viande, setViande] = useState("");
  const [lait, setLait] = useState("");
  const [seuil, setSeuil] = useState("");
  const [unite, setUnite] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Garde-fous : on n'accepte que des nombres finis là où c'est requis
  const viandeNum = viande.trim() === "" ? NaN : Number(viande);
  const laitNum = lait.trim() === "" ? NaN : Number(lait);
  const seuilNum = seuil.trim() === "" ? NaN : Number(seuil);

  const canSubmit =
    nom.trim().length > 0 &&
    categorie !== "" &&
    voie !== "" &&
    Number.isInteger(viandeNum) && viandeNum >= 0 &&
    Number.isInteger(laitNum) && laitNum >= 0 &&
    Number.isFinite(seuilNum) && seuilNum >= 0 &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/medicament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom_commercial: nom.trim(),
          categorie,
          voie_administration: voie,
          delai_attente_viande_jours: viandeNum,
          delai_attente_lait_jours: laitNum,
          seuil_alerte_stock: seuilNum,
          unite_mesure: unite.trim() || null,
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
          <h2><Pill size={18} /> Nouveau médicament</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="med-nom">Nom commercial *</label>
            <input id="med-nom" type="text" placeholder="Ex : Oxytétracycline 200"
              value={nom} autoFocus onChange={(e) => setNom(e.target.value)} />
          </div>

          <div className="med-form-row">
            <div className="adv-field">
              <label htmlFor="med-cat">Catégorie *</label>
              <select id="med-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                <option value="" disabled>— Choisir —</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="adv-field">
              <label htmlFor="med-voie">Voie d'administration *</label>
              <select id="med-voie" value={voie} onChange={(e) => setVoie(e.target.value)}>
                <option value="" disabled>— Choisir —</option>
                {VOIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="med-form-row">
            <div className="adv-field">
              <label htmlFor="med-viande">Délai d'attente viande (jours) *</label>
              <input id="med-viande" type="number" min="0" step="1" placeholder="Ex : 28"
                value={viande} onChange={(e) => setViande(e.target.value)} />
            </div>
            <div className="adv-field">
              <label htmlFor="med-lait">Délai d'attente lait (jours) *</label>
              <input id="med-lait" type="number" min="0" step="1" placeholder="Ex : 7"
                value={lait} onChange={(e) => setLait(e.target.value)} />
            </div>
          </div>

          <div className="med-form-row">
            <div className="adv-field">
              <label htmlFor="med-seuil">Seuil d'alerte de stock *</label>
              <input id="med-seuil" type="number" min="0" step="any" placeholder="Ex : 5"
                value={seuil} onChange={(e) => setSeuil(e.target.value)} />
            </div>
            <div className="adv-field">
              <label htmlFor="med-unite">Unité de mesure</label>
              <input id="med-unite" type="text" list="unites-medicament" placeholder="Ex : flacon (optionnel)"
                value={unite} onChange={(e) => setUnite(e.target.value)} />
              <datalist id="unites-medicament">
                {UNITES.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Le stock initial sera de <strong>0</strong>. Vous pourrez l'alimenter depuis la fiche via un achat.
          </p>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Création…</> : "Créer le médicament"}
          </button>
        </footer>
      </div>
    </div>
  );
}
