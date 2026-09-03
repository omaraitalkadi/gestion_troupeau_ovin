import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, PackagePlus, X, Loader2, ServerCrash, RefreshCw, Pill, Coins,
  Syringe, Ban, CalendarClock,
} from "lucide-react";
import "./sante.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

const CATEGORIE_LABEL = {
  VACCIN: "Vaccin", ANTIBIOTIQUE: "Antibiotique", ANTIPARASITAIRE: "Antiparasitaire",
  ANTI_INFLAMMATOIRE: "Anti-inflammatoire", VITAMINE_COMPLEMENT: "Vitamine / Complément",
};
const VOIE_LABEL = {
  INTRAMUSCULAIRE: "Intramusculaire", SOUS_CUTANEE: "Sous-cutanée",
  ORALE: "Orale", TOPIQUE: "Topique",
};
const fmtMAD = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(n);

const SEXE_LABEL = { MALE: "Mâles", FEMELLE: "Femelles" };

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtAge = (jours) => {
  if (jours == null) return "—";
  if (jours < 30) return `${jours} j`;
  if (jours < 365) return `${Math.round(jours / 30)} mois`;
  return `${(jours / 365).toFixed(1)} ans`;
};

function useMedicament(id) {
  const [med, setMed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMed = useCallback(async () => {
    if (!id) { setLoading(false); setError("Identifiant de médicament manquant dans l'URL."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/medicament/${id}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/sante/medicament/:id montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      if (!json.data) throw new Error("Réponse 200 sans données (forme attendue { data: {...} }).");
      setMed(json.data);
    } catch (e) {
      setError(e.message); setMed(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMed(); }, [fetchMed]);
  return { med, loading, error, refetch: fetchMed };
}

function useProgrammesVaccination(medicamentId) {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgrammes = useCallback(async () => {
    if (!medicamentId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/sante/programme-vaccination?medicament_id=${medicamentId}`
      );
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json"))
        throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/sante/programme-vaccination montée ?`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setProgrammes(json.data ?? []);
    } catch (e) {
      setError(e.message); setProgrammes([]);
    } finally {
      setLoading(false);
    }
  }, [medicamentId]);

  useEffect(() => { fetchProgrammes(); }, [fetchProgrammes]);
  return { programmes, loading, error, refetch: fetchProgrammes };
}

function ProgrammeRow({ programme, onVoirDetail, onDesactive }) {
  const [confirming, setConfirming] = useState(false);
  const [desactivating, setDesactivating] = useState(false);
  const [rowError, setRowError] = useState(null);

  const handleDesactiver = async () => {
    setDesactivating(true); setRowError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/sante/programme-vaccination/${programme.id}/desactiver`,
        { method: "PATCH" }
      );
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onDesactive?.(json.data);
    } catch (e) {
      setRowError(e.message);
      setDesactivating(false);
      setConfirming(false);
    }
  };

  return (
    <tr className={!programme.actif ? "is-inactive" : ""}>
      <td>
        <button className="link-cell" onClick={onVoirDetail} title="Voir le détail">
          {programme.nom}
        </button>
      </td>
      <td>
        À {fmtAge(programme.age_min_jours)}
        {programme.age_max_jours != null && (
          <span className="muted"> · limite {fmtAge(programme.age_max_jours)}</span>
        )}
      </td>
      <td>{programme.sexe ? SEXE_LABEL[programme.sexe] ?? programme.sexe : "Tous"}</td>
      <td>
        <span className={`programme-badge${programme.actif ? " is-active" : ""}`}>
          {programme.actif ? "Actif" : "Désactivé"}
        </span>
      </td>
      <td className="programme-row-actions">
        {programme.actif && !confirming && (
          <button className="btn-secondary btn-small" onClick={() => setConfirming(true)}>
            <Ban size={13} /> Désactiver
          </button>
        )}
        {programme.actif && confirming && (
          <span className="confirm-inline">
            <span>Confirmer ?</span>
            <button className="btn-danger btn-small" onClick={handleDesactiver} disabled={desactivating}>
              {desactivating ? <Loader2 size={13} className="spin" /> : "Oui"}
            </button>
            <button className="btn-secondary btn-small" onClick={() => setConfirming(false)} disabled={desactivating}>
              Non
            </button>
          </span>
        )}
        {rowError && <span className="form-error form-error-small">{rowError}</span>}
      </td>
    </tr>
  );
}

export default function MedicamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { med, loading, error, refetch } = useMedicament(id);
  const [showAchat, setShowAchat] = useState(false);
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const [programmeSelectionne, setProgrammeSelectionne] = useState(null);

  const {
    programmes,
    loading: programmesLoading,
    error: programmesError,
    refetch: refetchProgrammes,
  } = useProgrammesVaccination(med?.id);

  const stockBas = med && med.seuil_alerte_stock != null &&
    Number(med.quantite_en_stock ?? 0) <= Number(med.seuil_alerte_stock);

  return (
    <div className="medicament-detail-page">
      <header className="page-header">
        <div>
          <button className="link" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Retour</button>
          <p className="eyebrow">Santé · Pharmacie</p>
          <h1 className="page-title"><Pill size={22} /> {loading ? "Chargement…" : med?.nom_commercial ?? "Médicament"}</h1>
          {med && (
            <p className="page-subtitle">
              {CATEGORIE_LABEL[med.categorie] ?? med.categorie} · {VOIE_LABEL[med.voie_administration] ?? med.voie_administration}
            </p>
          )}
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={refetch} disabled={loading} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          <button className="btn-primary" onClick={() => setShowAchat(true)} disabled={loading || !med}>
            <PackagePlus size={16} /> Ajouter au stock
          </button>
          {med?.categorie === "VACCIN" && (
            <button
              className="btn-primary"
              onClick={() => setShowProgrammeForm(true)}
              disabled={loading || !med}
            >
              <Syringe size={16} /> Programmer vaccination
            </button>
          )}
        </div>
      </header>

      {loading && (
        <div className="table-state"><Loader2 size={28} className="spin" /><p>Chargement du médicament…</p></div>
      )}

      {!loading && error && (
        <div className="table-state is-error">
          <ServerCrash size={28} /><p>{error}</p>
          <button className="btn-secondary" onClick={refetch}><RefreshCw size={14} /> Réessayer</button>
        </div>
      )}

      {!loading && !error && med && (
        <div className="detail-cards">
          <div className={`detail-card${stockBas ? " is-warning" : ""}`}>
            <span className="detail-label">Stock actuel</span>
            <span className="detail-value">
              {Number(med.quantite_en_stock ?? 0).toLocaleString("fr-MA")} {med.unite_mesure ?? ""}
            </span>
            {stockBas && <span className="detail-sub">Sous le seuil d'alerte ({med.seuil_alerte_stock})</span>}
          </div>
          <div className="detail-card">
            <span className="detail-label">Prix unitaire moyen</span>
            <span className="detail-value">{med.prix_unitaire != null ? fmtMAD(med.prix_unitaire) : "—"}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Délai d'attente viande</span>
            <span className="detail-value">{med.delai_attente_viande_jours ?? "—"} j</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Délai d'attente lait</span>
            <span className="detail-value">{med.delai_attente_lait_jours ?? "—"} j</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Seuil d'alerte</span>
            <span className="detail-value">{med.seuil_alerte_stock ?? "—"} {med.unite_mesure ?? ""}</span>
          </div>
          <div className="detail-card">
            <span className="detail-label">Valeur du stock</span>
            <span className="detail-value">
              {med.prix_unitaire != null
                ? fmtMAD(Number(med.quantite_en_stock ?? 0) * Number(med.prix_unitaire))
                : "—"}
            </span>
          </div>
        </div>
      )}

      {!loading && !error && med && med.categorie === "VACCIN" && (
        <section className="programme-section">
          <div className="section-header">
            <h2><CalendarClock size={18} /> Programmes de vaccination</h2>
            <button className="btn-secondary" onClick={refetchProgrammes} disabled={programmesLoading} title="Rafraîchir">
              <RefreshCw size={14} className={programmesLoading ? "spin" : ""} />
            </button>
          </div>

          {programmesLoading && (
            <div className="table-state"><Loader2 size={22} className="spin" /><p>Chargement des programmes…</p></div>
          )}

          {!programmesLoading && programmesError && (
            <div className="table-state is-error">
              <ServerCrash size={22} /><p>{programmesError}</p>
              <button className="btn-secondary" onClick={refetchProgrammes}><RefreshCw size={14} /> Réessayer</button>
            </div>
          )}

          {!programmesLoading && !programmesError && programmes.length === 0 && (
            <div className="table-state">
              <p className="muted">Aucun programme configuré pour ce médicament.</p>
            </div>
          )}

          {!programmesLoading && !programmesError && programmes.length > 0 && (
            <table className="programme-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Âge déclencheur</th>
                  <th>Sexe</th>
                  <th>Statut</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {programmes.map((p) => (
                  <ProgrammeRow
                    key={p.id}
                    programme={p}
                    onVoirDetail={() => setProgrammeSelectionne(p)}
                    onDesactive={refetchProgrammes}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {showAchat && med && (
        <AchatMedicamentModal
          medicament={med}
          onClose={() => setShowAchat(false)}
          onSuccess={() => { setShowAchat(false); refetch(); }}
        />
      )}

      {showProgrammeForm && med && (
        <ProgrammerVaccinationModal
          medicament={med}
          onClose={() => setShowProgrammeForm(false)}
          onSuccess={() => { setShowProgrammeForm(false); refetchProgrammes(); }}
        />
      )}

      {programmeSelectionne && (
        <ProgrammeQuickPanel
          programmeId={programmeSelectionne.id}
          onClose={() => setProgrammeSelectionne(null)}
          onDesactive={() => { setProgrammeSelectionne(null); refetchProgrammes(); }}
        />
      )}
    </div>
  );
}

function AchatMedicamentModal({ medicament, onClose, onSuccess }) {
  const [quantite, setQuantite] = useState("");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const qteNum = quantite.trim() === "" ? NaN : Number(quantite);
  const montantNum = montant.trim() === "" ? NaN : Number(montant);
  const qteValide = Number.isFinite(qteNum) && qteNum > 0;
  const montantValide = Number.isFinite(montantNum) && montantNum >= 0;
  const canSubmit = qteValide && montantValide && !saving;
  const prixUnitaire = qteValide && montantValide ? montantNum / qteNum : null;
  const unite = medicament.unite_mesure ?? "unité";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/finance/achat/medicament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicament_id: medicament.id,
          quantite: qteNum,
          montant: montantNum,
          description: description.trim() || null,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Le serveur n'a pas renvoyé du JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onSuccess?.(json.data);
    } catch (e) {
      setError(e.message); setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Coins size={18} /> Achat — {medicament.nom_commercial}</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="ach-qte">Quantité ({unite}) *</label>
            <input id="ach-qte" type="number" min="0" step="any" placeholder="Ex : 10"
              value={quantite} autoFocus onChange={(e) => setQuantite(e.target.value)} />
          </div>
          <div className="adv-field">
            <label htmlFor="ach-montant">Prix total de l'achat (MAD) *</label>
            <input id="ach-montant" type="number" min="0" step="any" placeholder="Ex : 450"
              value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <div className="adv-field">
            <label htmlFor="ach-desc">Description (optionnel)</label>
            <input id="ach-desc" type="text" placeholder="Ex : Pharmacie vétérinaire El Jadida"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {prixUnitaire != null && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Prix unitaire de cet achat : <strong>{fmtMAD(prixUnitaire)}/{unite}</strong>
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Enregistrement…</> : "Enregistrer l'achat"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ProgrammerVaccinationModal({ medicament, onClose, onSuccess }) {
  const JOURS_PAR_MOIS = 30.44;

  const [nom, setNom] = useState("");
  const [uniteAge, setUniteAge] = useState("mois"); // "jours" | "mois"
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [sexe, setSexe] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});

  const versJours = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return NaN;
    return uniteAge === "mois" ? Math.round(n * JOURS_PAR_MOIS) : Math.round(n);
  };

  const ageMinJours = ageMin.trim() === "" ? NaN : versJours(ageMin);
  const ageMaxJours = ageMax.trim() === "" ? null : versJours(ageMax);

  const erreurs = {
    nom: nom.trim() === "" ? "Le nom du programme est requis." : null,
    ageMin: !Number.isFinite(ageMinJours) || ageMinJours < 0 ? "Âge déclencheur requis (0 ou plus)." : null,
    ageMax:
      ageMaxJours != null && (!Number.isFinite(ageMaxJours) || ageMaxJours < ageMinJours)
        ? "La limite d'âge doit être supérieure ou égale à l'âge déclencheur."
        : null,
  };
  const canSubmit = !Object.values(erreurs).some(Boolean) && !saving;

  const marquerTouche = (champ) => setTouched((t) => ({ ...t, [champ]: true }));

  const resumeTexte = (() => {
    if (!Number.isFinite(ageMinJours)) return null;
    const cible = sexe ? SEXE_LABEL[sexe].toLowerCase() : "tous les animaux";
    const limite = ageMaxJours != null
      ? ` Passé ${fmtAge(ageMaxJours)}, l'animal n'est plus concerné.`
      : "";
    return `Dès que ${cible} atteignent ${fmtAge(ageMinJours)}, une vaccination (dose unique) sera automatiquement programmée.${limite}`;
  })();

  const handleSubmit = async () => {
    setTouched({ nom: true, ageMin: true, ageMax: true });
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/programme-vaccination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicament_id: medicament.id,
          nom: nom.trim(),
          age_min_jours: ageMinJours,
          age_max_jours: ageMaxJours,
          sexe: sexe || null,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Le serveur n'a pas renvoyé du JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onSuccess?.(json.data);
    } catch (e) {
      setError(e.message); setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Syringe size={18} /> Programmer vaccination</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>
        <p className="modal-subtitle">
          Vaccin utilisé : <strong>{medicament.nom_commercial}</strong>. Une veille permanente
          programmera automatiquement une vaccination dès qu'un animal atteint l'âge déclencheur.
        </p>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="pv-nom">Nom du programme *</label>
            <input id="pv-nom" type="text" placeholder="Ex : Clostridiose agneaux"
              value={nom} autoFocus
              onChange={(e) => setNom(e.target.value)}
              onBlur={() => marquerTouche("nom")} />
            {touched.nom && erreurs.nom && <p className="field-error">{erreurs.nom}</p>}
          </div>

          <fieldset className="form-fieldset">
            <legend>Animaux ciblés</legend>

            <div className="adv-field">
              <label>Unité d'âge</label>
              <div className="unit-toggle">
                <button type="button" className={uniteAge === "jours" ? "is-selected" : ""} onClick={() => setUniteAge("jours")}>Jours</button>
                <button type="button" className={uniteAge === "mois" ? "is-selected" : ""} onClick={() => setUniteAge("mois")}>Mois</button>
              </div>
            </div>

            <div className="adv-field-row">
              <div className="adv-field">
                <label htmlFor="pv-age-min">Âge déclencheur ({uniteAge}) *</label>
                <input id="pv-age-min" type="number" min="0" step="any" placeholder={uniteAge === "mois" ? "Ex : 1" : "Ex : 30"}
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  onBlur={() => marquerTouche("ageMin")} />
                {touched.ageMin && erreurs.ageMin && <p className="field-error">{erreurs.ageMin}</p>}
              </div>
              <div className="adv-field">
                <label htmlFor="pv-age-max">Limite d'âge ({uniteAge})</label>
                <input id="pv-age-max" type="number" min="0" step="any" placeholder="Optionnel — aucune limite"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  onBlur={() => marquerTouche("ageMax")} />
                {touched.ageMax && erreurs.ageMax && <p className="field-error">{erreurs.ageMax}</p>}
              </div>
            </div>

            <div className="adv-field">
              <label htmlFor="pv-sexe">Sexe concerné</label>
              <select id="pv-sexe" value={sexe} onChange={(e) => setSexe(e.target.value)}>
                <option value="">Tous</option>
                <option value="MALE">Mâles uniquement</option>
                <option value="FEMELLE">Femelles uniquement</option>
              </select>
            </div>
          </fieldset>

          {resumeTexte && !Object.values(erreurs).some(Boolean) && (
            <p className="modal-summary"><CalendarClock size={14} /> {resumeTexte}</p>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <><Loader2 size={14} className="spin" /> Enregistrement…</> : <><Syringe size={14} /> Programmer vaccination</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

function useProgrammeDetail(programmeId) {
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgramme = useCallback(async () => {
    if (!programmeId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/programme-vaccination/${programmeId}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setProgramme(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [programmeId]);

  useEffect(() => { fetchProgramme(); }, [fetchProgramme]);
  return { programme, loading, error, refetch: fetchProgramme };
}

function ProgrammeQuickPanel({ programmeId, onClose, onDesactive }) {
  const { programme, loading, error } = useProgrammeDetail(programmeId);
  const [desactivating, setDesactivating] = useState(false);
  const [desactivateError, setDesactivateError] = useState(null);

  const handleDesactiver = async () => {
    setDesactivating(true); setDesactivateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sante/programme-vaccination/${programmeId}/desactiver`, {
        method: "PATCH",
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      onDesactive?.(json.data);
    } catch (e) {
      setDesactivateError(e.message);
      setDesactivating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <aside className="quick-panel" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Syringe size={18} /> Détail du programme</h2>
          <button className="icon-btn-small" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="modal-body">
          {loading && (
            <div className="table-state"><Loader2 size={22} className="spin" /><p>Chargement…</p></div>
          )}

          {!loading && error && (
            <div className="table-state is-error"><ServerCrash size={22} /><p>{error}</p></div>
          )}

          {!loading && !error && programme && (
            <div className="detail-cards">
              <div className="detail-card">
                <span className="detail-label">Nom</span>
                <span className="detail-value">{programme.nom}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Statut</span>
                <span className="detail-value">{programme.actif ? "Actif" : "Désactivé"}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Âge déclencheur</span>
                <span className="detail-value">{fmtAge(programme.age_min_jours)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Limite d'âge</span>
                <span className="detail-value">
                  {programme.age_max_jours != null ? fmtAge(programme.age_max_jours) : "Aucune"}
                </span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Sexe concerné</span>
                <span className="detail-value">{programme.sexe ? SEXE_LABEL[programme.sexe] ?? programme.sexe : "Tous"}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Créé le</span>
                <span className="detail-value">{fmtDate(programme.date_creation)}</span>
              </div>
              {programme.cree_par_utilisateur && (
                <div className="detail-card">
                  <span className="detail-label">Configuré par</span>
                  <span className="detail-value">
                    {programme.cree_par_utilisateur.prenom} {programme.cree_par_utilisateur.nom}
                  </span>
                </div>
              )}
            </div>
          )}

          {desactivateError && <p className="form-error">{desactivateError}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
          {programme?.actif && (
            <button className="btn-danger" onClick={handleDesactiver} disabled={desactivating}>
              {desactivating
                ? <><Loader2 size={14} className="spin" /> Désactivation…</>
                : <><Ban size={14} /> Désactiver</>}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}