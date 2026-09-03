import { useState, useEffect } from "react";
import { X, Loader2, Syringe } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost";

/**
 * Création d'une campagne de vaccination (statut PROGRAMMEE) AVEC ciblage
 * des animaux dans le même formulaire :
 *   1. POST /api/sante/compagne                  → crée la campagne
 *   2. POST /api/sante/compagne/:id/vaccinations → programme les vaccinations
 * "Tout le lot" → n'envoie que lot_id. "Toute la ferme" → toute_la_ferme.
 * onCreated(campagne) → le parent navigue vers la fiche.
 */
export default function NouvelleCampagneModal({ onClose, onCreated }) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [dateCloture, setDateCloture] = useState("");
  const [medicamentId, setMedicamentId] = useState("");

  const [vaccins, setVaccins] = useState([]);
  const [loadingMed, setLoadingMed] = useState(true);
  const [medError, setMedError] = useState(null);

  // Ciblage des animaux
  const [scope, setScope] = useState("lot"); // "lot" | "ferme"
  const [lots, setLots] = useState([]);
  const [lotsError, setLotsError] = useState(null);
  const [lotId, setLotId] = useState("");
  const [animals, setAnimals] = useState([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [animalsError, setAnimalsError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [toutLeLot, setToutLeLot] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Vaccins (catégorie VACCIN) + lots
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sante/medicaments`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}). Route GET /api/sante/medicaments montée ?`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) setVaccins((json.data ?? []).filter((m) => m.categorie === "VACCIN"));
      } catch (e) {
        if (alive) setMedError(e.message);
      } finally {
        if (alive) setLoadingMed(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/utilisateur/me`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) setLots(json.lots ?? []);
      } catch (e) {
        if (alive) setLotsError(e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Animaux du lot sélectionné
  useEffect(() => {
    if (scope !== "lot" || !lotId) { setAnimals([]); setSelected(new Set()); setToutLeLot(false); return; }
    let alive = true;
    setLoadingAnimals(true); setAnimalsError(null);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/lots/${lotId}/animals?limit=1000`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error(`Réponse non-JSON (${res.status}).`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        if (alive) { setAnimals(json.data ?? []); setSelected(new Set()); setToutLeLot(false); }
      } catch (e) {
        if (alive) setAnimalsError(e.message);
      } finally {
        if (alive) setLoadingAnimals(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, lotId]);

  const toggle = (aid) =>
    setSelected((p) => { const n = new Set(p); n.has(aid) ? n.delete(aid) : n.add(aid); return n; });

  const scopeValide =
    scope === "ferme" ||
    (scope === "lot" && lotId && (toutLeLot || selected.size > 0));

  const canSubmit = nom.trim().length > 0 && medicamentId !== "" && scopeValide && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    // Périmètre : "tout le lot" n'envoie que lot_id (réseau minimal)
    let cible;
    if (scope === "ferme") cible = { toute_la_ferme: true };
    else if (toutLeLot) cible = { lot_id: lotId, tout_le_lot: true };
    else cible = { animal_ids: [...selected] };

    try {
      // Une seule requête : la campagne ET les vaccinations sont créées côté serveur
      const res = await fetch(`${API_BASE}/api/sante/compagne`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          description: description.trim() || null,
          date_debut_prevue: dateDebut || null,
          date_fin_prevue: dateFin || null,
          date_cloture_reelle: dateCloture || null,
          medicament_id: medicamentId,
          ...cible,
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
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "36rem" }}>
        <header className="modal-header">
          <h2><Syringe size={18} /> Nouvelle campagne de vaccination</h2>
          <button className="icon-btn-small" onClick={onClose} disabled={saving}><X size={16} /></button>
        </header>

        <div className="modal-body">
          <div className="adv-field">
            <label htmlFor="camp-nom">Nom *</label>
            <input id="camp-nom" type="text" placeholder="Ex : Clostridiose — Printemps 2026"
              value={nom} autoFocus onChange={(e) => setNom(e.target.value)} />
          </div>

          <div className="adv-field">
            <label htmlFor="camp-desc">Description</label>
            <textarea id="camp-desc" rows={2} placeholder="Objectif, protocole, remarques…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="med-form-row">
            <div className="adv-field">
              <label htmlFor="camp-debut">Date de début prévue</label>
              <input id="camp-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div className="adv-field">
              <label htmlFor="camp-fin">Date de fin prévue</label>
              <input id="camp-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>
          </div>

          <div className="adv-field">
            <label htmlFor="camp-cloture">Date de clôture réelle</label>
            <input id="camp-cloture" type="date" value={dateCloture} onChange={(e) => setDateCloture(e.target.value)} />
          </div>

          <div className="adv-field">
            <label htmlFor="camp-med">Vaccin utilisé *</label>
            {medError && <p className="form-error">{medError}</p>}
            <select id="camp-med" value={medicamentId} onChange={(e) => setMedicamentId(e.target.value)}
              disabled={loadingMed || vaccins.length === 0}>
              <option value="" disabled>
                {loadingMed ? "Chargement…" : vaccins.length === 0 ? "Aucun vaccin disponible" : "— Choisir un vaccin —"}
              </option>
              {vaccins.map((m) => <option key={m.id} value={m.id}>{m.nom_commercial}</option>)}
            </select>
            {!loadingMed && vaccins.length === 0 && !medError && (
              <p className="muted" style={{ fontSize: "0.8rem" }}>
                Crée d'abord un médicament de catégorie <strong>Vaccin</strong>.
              </p>
            )}
          </div>

          {/* ── Animaux à vacciner ── */}
          <div className="adv-field">
            <label>Animaux à vacciner *</label>
            <div className="seg" role="tablist" style={{ alignSelf: "flex-start" }}>
              <button type="button" className={scope === "lot" ? "is-active" : ""} onClick={() => setScope("lot")}>Un lot</button>
              <button type="button" className={scope === "ferme" ? "is-active" : ""} onClick={() => setScope("ferme")}>Toute la ferme</button>
            </div>

            {scope === "ferme" && (
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Tous les animaux de la ferme seront programmés pour cette campagne.
              </p>
            )}

            {scope === "lot" && (
              <>
                {lotsError && <p className="form-error">{lotsError}</p>}
                <select value={lotId} onChange={(e) => setLotId(e.target.value)} style={{ marginTop: 8 }}>
                  <option value="" disabled>— Choisir un lot —</option>
                  {lots.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>

                {lotId && (
                  <>
                    {animalsError && <p className="form-error">{animalsError}</p>}
                    {loadingAnimals && (
                      <p className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Loader2 size={14} className="spin" /> Chargement des animaux…
                      </p>
                    )}
                    {!loadingAnimals && !animalsError && (
                      <>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, cursor: "pointer", marginTop: 8 }}>
                          <input type="checkbox" checked={toutLeLot} onChange={(e) => setToutLeLot(e.target.checked)} />
                          Tout le lot ({animals.length})
                        </label>
                        {!toutLeLot && (
                          <div style={{ maxHeight: "30vh", overflowY: "auto", border: "1px solid var(--border, #e6e9ec)", borderRadius: 10, marginTop: 6 }}>
                            {animals.map((a) => (
                              <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border, #eef0f1)", cursor: "pointer" }}>
                                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                                <span style={{ fontFamily: "monospace" }}>{a.numero_rfid ?? a.numero_legal ?? a.id.slice(0, 8)}</span>
                                {a.race && <span className="muted" style={{ fontSize: "0.8rem" }}>{a.race}</span>}
                              </label>
                            ))}
                            {animals.length === 0 && <p className="muted" style={{ padding: 12, margin: 0 }}>Aucun animal dans ce lot.</p>}
                          </div>
                        )}
                        {!toutLeLot && <span className="badge badge-muted" style={{ marginTop: 6 }}>{selected.size} sélectionné(s)</span>}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {saving
              ? <><Loader2 size={14} className="spin" /> Création…</>
              : "Créer et programmer"}
          </button>
        </footer>
      </div>
    </div>
  );
}