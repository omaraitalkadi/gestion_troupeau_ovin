import { useEffect, useState, useCallback, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import "./nouvel-animal-modal.css";

const API_BASE = document.location.origin || "http://localhost";

const SEXE_OPTIONS = [
  { value: "MALE", label: "Mâle" },
  { value: "FEMELLE", label: "Femelle" },
];

const ETAT_OPTIONS = [
  { value: "SAIN", label: "Sain" },
  { value: "MALADE", label: "Malade" },
  { value: "SOUS_TRAITEMENT", label: "Sous traitement" },
  { value: "ISOLE", label: "Isolé" },
];

const CONDITION_OPTIONS = [
  { value: "MAIGRE", label: "Maigre" },
  { value: "NORMALE", label: "Normale" },
  { value: "GRASSE", label: "Grasse" },
];

const NOUVELLE_RACE = "__nouvelle_race__";

const emptyForm = {
  numero_rfid: "",
  numero_legal: "",
  sexe: "",
  lot_id: "",
  race: "",
  race_custom: "",
  date_naissance: "",
  date_arrivee: new Date().toISOString().slice(0, 10),
  poids: "",
  etat: "SAIN",
  condition_corporelle: "NORMALE",
};

function validate(form, raceOptions) {
  const errors = {};
  if (!form.numero_rfid.trim() && !form.numero_legal.trim()) {
    errors.identifiant = "Renseignez au moins le numéro RFID ou le numéro légal.";
  }
  if (!form.sexe) {
    errors.sexe = "Le sexe est requis.";
  }
  if (!form.lot_id) {
    errors.lot_id = "Le lot est requis.";
  }
  const raceFinale = form.race === NOUVELLE_RACE ? form.race_custom.trim() : form.race;
  if (!raceFinale) {
    errors.race = raceOptions.length === 0 ? "La race est requise." : "Sélectionnez une race ou saisissez-en une nouvelle.";
  }
  if (form.poids !== "" && Number(form.poids) <= 0) {
    errors.poids = "Le poids doit être un nombre positif.";
  }
  return errors;
}

export default function NouvelAnimalModal({ lots = [], fermeId, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Verrouille le scroll de la page pendant que la modale est ouverte
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fermeture au clavier (Échap)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Races — mêmes valeurs que les chips de filtre (Dashboard/Troupeau) :
  // accumulées depuis lot.races plutôt que fetchées séparément, donc
  // toujours cohérentes avec ce qui est déjà affiché ailleurs.
  const raceOptions = useMemo(() => {
    const set = new Set();
    lots.forEach((lot) => (lot.races ?? []).forEach((r) => r && set.add(r)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [lots]);

  const updateField = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validate(form, raceOptions);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const race = form.race === NOUVELLE_RACE ? form.race_custom.trim() : form.race;

    const payload = {
      numero_rfid: form.numero_rfid.trim() || null,
      numero_legal: form.numero_legal.trim() || null,
      sexe: form.sexe,
      lot_id: form.lot_id,
      race,
      date_naissance: form.date_naissance || null,
      date_arrivee: form.date_arrivee || null,
      poids: form.poids !== "" ? Number(form.poids) : null,
      etat: form.etat,
      condition_corporelle: form.condition_corporelle,
      ferme_id: fermeId ?? null,
    };

    try {
      const res = await fetch(`${API_BASE}/api/animals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Erreur ${res.status}`);
      }

      const created = await res.json();
      onCreated?.(created);
      onClose();
    } catch (err) {
      setSubmitError(err.message || "La création a échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="nouvel-animal-title">
        <div className="modal-head">
          <h2 id="nouvel-animal-title">Nouvel animal</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {submitError && <div className="form-banner form-banner--error">{submitError}</div>}

          <div className="form-section">
            <div className="form-section-title">Identification</div>
            <div className="form-row">
              <label className="form-field">
                <span>Numéro RFID</span>
                <input
                  type="text"
                  value={form.numero_rfid}
                  onChange={(e) => updateField("numero_rfid", e.target.value)}
                  placeholder="FR-000000000000"
                />
              </label>
              <label className="form-field">
                <span>Numéro légal</span>
                <input
                  type="text"
                  value={form.numero_legal}
                  onChange={(e) => updateField("numero_legal", e.target.value)}
                  placeholder="Ex: 12345/A"
                />
              </label>
            </div>
            {errors.identifiant && <div className="field-error">{errors.identifiant}</div>}
            <p className="form-hint">Au moins un des deux identifiants est requis.</p>
          </div>

          <div className="form-section">
            <div className="form-section-title">Caractéristiques</div>
            <div className="form-row">
              <label className="form-field">
                <span>Sexe *</span>
                <select
                  value={form.sexe}
                  onChange={(e) => updateField("sexe", e.target.value)}
                  className={errors.sexe ? "has-error" : ""}
                >
                  <option value="">Sélectionner…</option>
                  {SEXE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.sexe && <span className="field-error">{errors.sexe}</span>}
              </label>

              <label className="form-field">
                <span>Lot *</span>
                <select
                  value={form.lot_id}
                  onChange={(e) => updateField("lot_id", e.target.value)}
                  className={errors.lot_id ? "has-error" : ""}
                >
                  <option value="">Sélectionner…</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.nom}
                    </option>
                  ))}
                </select>
                {errors.lot_id && <span className="field-error">{errors.lot_id}</span>}
                {lots.length === 0 && (
                  <span className="form-hint">Aucun lot disponible pour cette ferme.</span>
                )}
              </label>
            </div>

            <div className="form-row">
              <label className="form-field">
                <span>Race *</span>
                {raceOptions.length > 0 ? (
                  <select
                    value={form.race}
                    onChange={(e) => updateField("race", e.target.value)}
                    className={errors.race ? "has-error" : ""}
                  >
                    <option value="">Sélectionner…</option>
                    {raceOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value={NOUVELLE_RACE}>+ Nouvelle race…</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.race_custom}
                    onChange={(e) => updateField("race_custom", e.target.value)}
                    placeholder="Ex: Sardi"
                    className={errors.race ? "has-error" : ""}
                  />
                )}
                {errors.race && <span className="field-error">{errors.race}</span>}
                {raceOptions.length === 0 && (
                  <span className="form-hint">
                    Aucune race encore enregistrée sur cette ferme — elle sera proposée dans les filtres dès qu'un animal l'utilise.
                  </span>
                )}
              </label>

              {form.race === NOUVELLE_RACE && (
                <label className="form-field">
                  <span>Nom de la nouvelle race *</span>
                  <input
                    type="text"
                    value={form.race_custom}
                    onChange={(e) => updateField("race_custom", e.target.value)}
                    placeholder="Ex: Sardi"
                    className={errors.race ? "has-error" : ""}
                    autoFocus
                  />
                </label>
              )}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Dates &amp; poids</div>
            <div className="form-row">
              <label className="form-field">
                <span>Date de naissance</span>
                <input
                  type="date"
                  value={form.date_naissance}
                  onChange={(e) => updateField("date_naissance", e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Date d'arrivée</span>
                <input
                  type="date"
                  value={form.date_arrivee}
                  onChange={(e) => updateField("date_arrivee", e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Poids (kg)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.poids}
                  onChange={(e) => updateField("poids", e.target.value)}
                  className={errors.poids ? "has-error" : ""}
                />
                {errors.poids && <span className="field-error">{errors.poids}</span>}
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">État</div>
            <div className="form-row">
              <label className="form-field">
                <span>État de santé</span>
                <select value={form.etat} onChange={(e) => updateField("etat", e.target.value)}>
                  {ETAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Condition corporelle</span>
                <select
                  value={form.condition_corporelle}
                  onChange={(e) => updateField("condition_corporelle", e.target.value)}
                >
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting && <Loader2 size={16} className="spin" />}
              {submitting ? "Création…" : "Créer l'animal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}