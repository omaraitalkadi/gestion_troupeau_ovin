// ChangerLotButton.jsx — bouton "Changer de lot".
// Si l'animal est un BÉLIER : prévient que le mouvement vers un lot contenant
// des brebis EN_CHALEUR vaut saillie. Si l'utilisateur accepte → PAS de simple
// mouvement : on appelle l'API saillie (Modèle A) avec le lot_id (elle avance
// les brebis EN_CHALEUR du lot). Sinon → simple changement de lot.
//
// Usage : <ChangerLotButton animal={animal} onChanged={reload} />
import { useEffect, useState } from "react";
import { Layers, Loader2, AlertCircle, Check, X } from "lucide-react";

const API = document.location.origin || "http://localhost";
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

export default function ChangerLotButton({ animal, onChanged }) {
  const [open, setOpen] = useState(false);
  const estBelier = animal?.sexe === "MALE";

  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Layers size={14} /> Changer de lot
      </button>
      {open && (
        <ChangerLotModal
          animal={animal}
          estBelier={estBelier}
          onClose={() => setOpen(false)}
          onChanged={() => { setOpen(false); onChanged?.(); }}
        />
      )}
    </>
  );
}

function ChangerLotModal({ animal, estBelier, onClose, onChanged }) {
  const [lots, setLots] = useState(null);
  const [lotId, setLotId] = useState("");
  const [dateSaillie, setDateSaillie] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmSaillie, setConfirmSaillie] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api("/api/lots");
        setLots((r.data ?? r ?? []).filter((l) => l.id !== animal.lot_id));
      } catch (e) { setErr(e.message); setLots([]); }
    })();
  }, [animal.lot_id]);

  // Simple changement de lot
  const faireMouvementSeul = async () => {
    setBusy(true); setErr(null);
    try {
      await api(`/api/animals/${animal.id}/lot`, "PATCH", { lot_id: lotId });
      onChanged?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  // Bélier + acceptation : PAS de mouvement simple → saillie du lot (Modèle A)
   // Bélier + acceptation : déplacer le bélier dans le lot PUIS déclarer la saillie du lot.
  const faireSaillieLot = async () => {
    setBusy(true); setErr(null);
    try {
      // 1) déplacer physiquement le bélier dans le lot cible
      await api(`/api/animals/${animal.id}/lot`, "PATCH", { lot_id: lotId });
      // 2) saillie du lot (Modèle A) : avance les brebis EN_CHALEUR du lot
      await api("/api/reproduction/saillie", "POST", {
        belier_id: animal.id, lot_id: lotId, date_saillie: dateSaillie,
      });
      onChanged?.();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const onValider = () => {
    if (!lotId) { setErr("Choisissez un lot."); return; }
    // Si bélier → on demande d'abord confirmation (saillie du lot)
    if (estBelier) setConfirmSaillie(true);
    else faireMouvementSeul();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2><Layers size={18} /> Changer de lot</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </header>

        {err && <div className="inline-error"><AlertCircle size={14} /> {err}</div>}

        {!confirmSaillie ? (
          <div className="modal-body">
            <label className="bp-label">Lot de destination</label>
            {lots == null ? (
              <p className="muted-row"><Loader2 size={13} className="spin" /> Chargement…</p>
            ) : (
              <select value={lotId} onChange={(e) => setLotId(e.target.value)} className="bp-select">
                <option value="">— Choisir —</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
            )}
            {estBelier && (
              <p className="modal-note">
                <AlertCircle size={13} /> Cet animal est un bélier : le déplacer vers un lot
                contenant des brebis en chaleur sera enregistré comme une <strong>saillie</strong>.
              </p>
            )}
            <div className="modal-footer">
              <button className="btn-ghost btn-sm" onClick={onClose} disabled={busy}>Annuler</button>
              <button className="btn-primary btn-sm" onClick={onValider} disabled={busy || !lotId}>
                Continuer
              </button>
            </div>
          </div>
        ) : (
          // Confirmation saillie (bélier)
          <div className="modal-body">
            <p className="confirm-text">
              Déplacer ce bélier dans ce lot déclenchera une <strong>saillie pour toutes les
              brebis en chaleur</strong> du lot. Confirmer ?
            </p>
            <label className="bp-label">Date de saillie</label>
            <input type="date" value={dateSaillie} max={new Date().toISOString().slice(0,10)}
              onChange={(e) => setDateSaillie(e.target.value)} className="bp-input" />
            <div className="modal-footer modal-footer-col">
              <button className="btn-primary btn-sm" onClick={faireSaillieLot} disabled={busy}>
                {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Oui, déclarer la saillie
              </button>
              <button className="btn-ghost btn-sm" onClick={faireMouvementSeul} disabled={busy}>
                Non, déplacer seulement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
