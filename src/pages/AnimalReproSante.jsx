// AnimalReproSante.jsx
// Panneaux Reproduction + Gestations + Vaccinations pour la fiche animal, avec
// toutes les actions du cycle. À insérer dans AnimalDetail :
//   import AnimalReproSante from "./AnimalReproSante";
//   <AnimalReproSante animal={animal} lot={lot} onChanged={reload} />
// (onChanged : recharge la fiche après une action qui modifie l'animal/lot)
import { useCallback, useEffect, useState } from "react";
import {
  Heart, Baby, Syringe, Layers, Check, X, Loader2, AlertCircle, ChevronRight,
} from "lucide-react";

const API = document.location.origin || "http://localhost";
const fmt = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

async function api(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || "Erreur");
  return json;
}

const STATUTS_ACTIFS = ["EN_CHALEUR", "SAILLIE", "GESTANTE"];
const STATUT_LABEL = {
  EN_CHALEUR: "En chaleur", SAILLIE: "Saillie", GESTANTE: "Gestante",
  NON_SAILLIE: "Non saillie", NON_GESTANTE: "Non gestante", CLOTUREE: "Clôturée",
};

export default function AnimalReproSante({ animal, lot, onChanged }) {
  const estFemelle = animal?.sexe === "FEMELLE";
  return (
    <>
      {estFemelle && <ReproPanel animal={animal} onChanged={onChanged} />}
      {estFemelle && <GestationsPanel animal={animal} onChanged={onChanged} />}
      <VaccinationsPanel animal={animal} />
    </>
  );
}

/* ══════════════ REPRODUCTION ══════════════ */
function ReproPanel({ animal, onChanged }) {
  const [repros, setRepros] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/reproduction/animal/${animal.id}`);
      setRepros(Array.isArray(r) ? r : (r.data ?? []));
    } catch (e) { setError(e.message); }
  }, [animal.id]);
  useEffect(() => { load(); }, [load]);

  // Peut déclarer une chaleur si aucune repro active (EN_CHALEUR/SAILLIE/GESTANTE)
  const aCycleActif = (repros ?? []).some((r) => STATUTS_ACTIFS.includes(r.statut));
  const peutDeclarerChaleur = repros != null && !aCycleActif;

  const declarerChaleur = async () => {
    setBusy(true); setError(null);
    try {
      await api("/api/reproduction/chaleur", "POST", { animal_id: animal.id });
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2><Heart size={16} /> Reproduction</h2>
        {peutDeclarerChaleur && (
          <button className="btn-primary btn-sm" onClick={declarerChaleur} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <Heart size={14} />} Déclarer une chaleur
          </button>
        )}
      </div>

      {error && <div className="inline-error"><AlertCircle size={14} /> {error}</div>}
      {repros == null ? (
        <p className="muted-row"><Loader2 size={14} className="spin" /> Chargement…</p>
      ) : repros.length === 0 ? (
        <p className="muted-row">Aucune reproduction enregistrée.</p>
      ) : (
        <ul className="repro-list">
          {repros.map((r) => (
            <ReproItem key={r.id} repro={r} lotId={animal.lot_id} onDone={() => { load(); onChanged?.(); }} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReproItem({ repro, lotId, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [choixBelier, setChoixBelier] = useState(false);

  const act = async (fn) => {
    setBusy(true); setErr(null);
    try { await fn(); onDone?.(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  const marquerNonSaillie   = () => act(() => api(`/api/reproduction/${repro.id}/non-saillie`, "POST"));
  const confirmerGestation  = () => act(() => api(`/api/reproduction/${repro.id}/gestation`, "POST"));
  const marquerNonGestante  = () => act(() => api(`/api/reproduction/${repro.id}/non-gestante`, "POST"));

  return (
    <li className="repro-item">
      <div className="repro-item-main">
        <span className={`repro-badge repro-${repro.statut?.toLowerCase()}`}>
          {STATUT_LABEL[repro.statut] ?? repro.statut}
        </span>
        <span className="repro-dates">
          Créée {fmt(repro.date_creation)}
          {repro.date_saillie && ` · saillie ${fmt(repro.date_saillie)}`}
          {repro.date_prevue_mise_bas && ` · mise bas prévue ${fmt(repro.date_prevue_mise_bas)}`}
        </span>
      </div>

      {err && <div className="inline-error"><AlertCircle size={13} /> {err}</div>}

      {/* EN_CHALEUR → saillie (choix bélier) / non saillie */}
      {repro.statut === "EN_CHALEUR" && !choixBelier && (
        <div className="repro-actions">
          <button className="btn-primary btn-sm" onClick={() => setChoixBelier(true)} disabled={busy}>
            Marquer saillie
          </button>
          <button className="btn-ghost btn-sm" onClick={marquerNonSaillie} disabled={busy}>
            Non saillie
          </button>
        </div>
      )}
      {repro.statut === "EN_CHALEUR" && choixBelier && (
        <ChoixBelier
          lotId={lotId}
          brebisId={repro.brebis_id}
          onCancel={() => setChoixBelier(false)}
          onConfirmed={onDone}
        />
      )}

      {/* SAILLIE → gestante / non gestante */}
      {repro.statut === "SAILLIE" && (
        <div className="repro-actions">
          <button className="btn-primary btn-sm" onClick={confirmerGestation} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : null} Confirmer gestation
          </button>
          <button className="btn-ghost btn-sm" onClick={marquerNonGestante} disabled={busy}>
            Non gestante
          </button>
        </div>
      )}
    </li>
  );
}

// Liste des béliers du lot → choisir celui qui a fait la saillie → POST /saillie
function ChoixBelier({ lotId, brebisId, onCancel, onConfirmed }) {
  const [beliers, setBeliers] = useState(null);
  const [belierId, setBelierId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (!lotId) { setBeliers([]); return; }
        const r = await api(`/api/lots/${lotId}/animals`);
        const list = (r.data ?? r ?? []).filter((a) => a.sexe === "MALE" && ["ACTIF", "EN_QUARANTAINE"].includes(a.status));
        setBeliers(list);
      } catch (e) { setErr(e.message); setBeliers([]); }
    })();
  }, [lotId]);

  const confirmer = async () => {
    if (!belierId) { setErr("Choisissez un bélier."); return; }
    setBusy(true); setErr(null);
    try {
      // API saillie (Modèle A) : cible la brebis, avance sa repro EN_CHALEUR
      await api("/api/reproduction/saillie", "POST", {
        brebis_id: brebisId, belier_id: belierId, date_saillie: date,
      });
      onConfirmed?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="belier-picker">
      {err && <div className="inline-error"><AlertCircle size={13} /> {err}</div>}
      <label className="bp-label">Bélier ayant fait la saillie</label>
      {beliers == null ? (
        <p className="muted-row"><Loader2 size={13} className="spin" /> Chargement des béliers…</p>
      ) : beliers.length === 0 ? (
        <p className="muted-row">Aucun bélier disponible dans ce lot.</p>
      ) : (
        <select value={belierId} onChange={(e) => setBelierId(e.target.value)} className="bp-select">
          <option value="">— Choisir —</option>
          {beliers.map((b) => (
            <option key={b.id} value={b.id}>{b.numero_rfid ?? b.numero_legal ?? b.id}</option>
          ))}
        </select>
      )}
      <label className="bp-label">Date de saillie</label>
      <input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} className="bp-input" />
      <div className="repro-actions">
        <button className="btn-primary btn-sm" onClick={confirmer} disabled={busy || !beliers?.length}>
          {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Confirmer la saillie
        </button>
        <button className="btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </div>
  );
}

/* ══════════════ GESTATIONS ══════════════ */
function GestationsPanel({ animal, onChanged }) {
  const [repros, setRepros] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      // getReproductionsDetail : reproductions avec gestation + naissance imbriquées
      const r = await api(`/api/reproduction/animal/${animal.id}`);
      setRepros(Array.isArray(r) ? r : (r.data ?? []));
    } catch (e) { setErr(e.message); }
  }, [animal.id]);
  useEffect(() => { load(); }, [load]);

  // aplatit les gestations depuis les reproductions
  const gestations = [];
  for (const r of repros ?? []) {
    const g = r.gestation;
    if (g) gestations.push({ ...g, reproduction: r });
  }

  return (
    <section className="card">
      <div className="card-head"><h2><Baby size={16} /> Gestations</h2></div>
      {err && <div className="inline-error"><AlertCircle size={14} /> {err}</div>}
      {repros == null ? (
        <p className="muted-row"><Loader2 size={14} className="spin" /> Chargement…</p>
      ) : gestations.length === 0 ? (
        <p className="muted-row">Aucune gestation.</p>
      ) : (
        <ul className="repro-list">
          {gestations.map((g) => (
            <GestationItem key={g.id} gestation={g} onDone={() => { load(); onChanged?.(); }} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GestationItem({ gestation, onDone }) {
  const [form, setForm] = useState(false);
  const enCours = gestation.etat === "EN_COURS";
  const naissance = gestation.naissance;

  return (
    <li className="repro-item">
      <div className="repro-item-main">
        <span className={`repro-badge repro-${(gestation.etat ?? "").toLowerCase()}`}>
          {gestation.etat === "EN_COURS" ? "En cours" : gestation.etat === "TERMINEE" ? "Terminée" : gestation.etat}
        </span>
        <span className="repro-dates">
          {gestation.date_fin_prevue && `Mise bas prévue ${fmt(gestation.date_fin_prevue)}`}
          {naissance && ` · né(s) ${fmt(naissance.date_naissance)} (${naissance.nombre_agneaux ?? "?"})`}
        </span>
      </div>

      {enCours && !form && (
        <div className="repro-actions">
          <button className="btn-primary btn-sm" onClick={() => setForm(true)}>
            <Baby size={13} /> Déclarer la naissance
          </button>
        </div>
      )}
      {enCours && form && (
        <NaissanceForm gestationId={gestation.id} onCancel={() => setForm(false)} onDone={onDone} />
      )}
    </li>
  );
}

// Formulaire des agneaux nés → POST /reproduction/:gestationId/naissance
function NaissanceForm({ gestationId, onCancel, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [agneaux, setAgneaux] = useState([{ sexe: "FEMELLE", numero_rfid: "", numero_legal: "", poids: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const set = (i, k, v) => setAgneaux((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const add = () => setAgneaux((a) => [...a, { sexe: "FEMELLE", numero_rfid: "", numero_legal: "", poids: "" }]);
  const rm = (i) => setAgneaux((a) => a.filter((_, j) => j !== i));

  const submit = async () => {
    // chaque agneau : rfid OU légal obligatoire
    for (const [i, a] of agneaux.entries()) {
      if (!a.numero_rfid.trim() && !a.numero_legal.trim()) {
        setErr(`Agneau ${i + 1} : RFID ou n° légal obligatoire.`); return;
      }
    }
    setBusy(true); setErr(null);
    try {
      await api(`/api/reproduction/${gestationId}/naissance`, "POST", {
        date_naissance: date,
        agneaux: agneaux.map((a) => ({
          sexe: a.sexe,
          numero_rfid: a.numero_rfid.trim() || null,
          numero_legal: a.numero_legal.trim() || null,
          poids: a.poids ? Number(a.poids) : null,
        })),
      });
      onDone?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="naissance-form">
      {err && <div className="inline-error"><AlertCircle size={13} /> {err}</div>}
      <label className="bp-label">Date de naissance</label>
      <input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} className="bp-input" />

      <label className="bp-label">Agneaux</label>
      {agneaux.map((a, i) => (
        <div key={i} className="agneau-row">
          <select value={a.sexe} onChange={(e) => set(i, "sexe", e.target.value)} className="bp-select">
            <option value="FEMELLE">Femelle</option>
            <option value="MALE">Mâle</option>
          </select>
          <input placeholder="RFID" value={a.numero_rfid} onChange={(e) => set(i, "numero_rfid", e.target.value)} className="bp-input" />
          <input placeholder="N° légal" value={a.numero_legal} onChange={(e) => set(i, "numero_legal", e.target.value)} className="bp-input" />
          <input placeholder="Poids kg" type="number" value={a.poids} onChange={(e) => set(i, "poids", e.target.value)} className="bp-input bp-input-sm" />
          {agneaux.length > 1 && (
            <button className="btn-icon" onClick={() => rm(i)} title="Retirer"><X size={14} /></button>
          )}
        </div>
      ))}
      <button className="btn-ghost btn-sm" onClick={add}>+ Ajouter un agneau</button>

      <div className="repro-actions">
        <button className="btn-primary btn-sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Enregistrer la naissance
        </button>
        <button className="btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </div>
  );
}

/* ══════════════ VACCINATIONS ══════════════ */
function VaccinationsPanel({ animal }) {
  const [vaccs, setVaccs] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api(`/api/sante/vaccinations/animal/${animal.id}`);
      setVaccs(Array.isArray(r) ? r : (r.data ?? []));
    } catch (e) { setErr(e.message); }
  }, [animal.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="card">
      <div className="card-head"><h2><Syringe size={16} /> Vaccinations</h2></div>
      {err && <div className="inline-error"><AlertCircle size={14} /> {err}</div>}
      {vaccs == null ? (
        <p className="muted-row"><Loader2 size={14} className="spin" /> Chargement…</p>
      ) : vaccs.length === 0 ? (
        <p className="muted-row">Aucune vaccination.</p>
      ) : (
        <ul className="repro-list">
          {vaccs.map((v) => <VaccItem key={v.id} vacc={v} onDone={load} />)}
        </ul>
      )}
    </section>
  );
}

function VaccItem({ vacc, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const faite = vacc.effectue === true || vacc.statut === "EFFECTUEE";

  const marquer = async () => {
    setBusy(true); setErr(null);
    try {
      await api(`/api/sante/vaccinations/${vacc.id}/effectuee`, "PATCH", {});
      onDone?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <li className="repro-item">
      <div className="repro-item-main">
        <span className={`repro-badge ${faite ? "repro-terminee" : "repro-en_chaleur"}`}>
          {faite ? "Effectuée" : "À faire"}
        </span>
        <span className="repro-dates">
          {vacc.medicament?.nom_commercial ?? vacc.medicament?.nom ?? "Vaccin"}
          {vacc.date_prevue && ` · prévue ${fmt(vacc.date_prevue)}`}
          {faite && vacc.date_vaccination && ` · faite ${fmt(vacc.date_vaccination)}`}
        </span>
      </div>
      {err && <div className="inline-error"><AlertCircle size={13} /> {err}</div>}
      {!faite && (
        <div className="repro-actions">
          <button className="btn-primary btn-sm" onClick={marquer} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Marquer effectuée
          </button>
        </div>
      )}
    </li>
  );
}
