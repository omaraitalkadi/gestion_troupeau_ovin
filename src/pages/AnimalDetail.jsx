import {useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Layers, GitBranch } from "lucide-react";
import AnimalReproSante from "./AnimalReproSante";
import ChangerLotButton from "./ChangerLotButton";
import "./animal-repro-sante.css";
import "./animalDetail.css";

const API_BASE = document.location.origin || "http://localhost";

// How many generations to show: 1 = subject only, 2 = + parents, 3 = + grandparents.
// Bump to 4 for great-grandparents (wider tree, more lookups).
const GENERATIONS = 3;

const SEXE_LABEL = { MALE: "Mâle", FEMELLE: "Femelle" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function ageLabel(dateStr) {
  if (!dateStr) return null;
  const months = Math.floor((Date.now() - new Date(dateStr).getTime()) / (30.44 * 864e5));
  if (months < 0) return null;
  return months < 24 ? `${months} mois` : `${Math.floor(months / 12)} ans`;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Maternal/paternal chain label, e.g. gen2 idx2 -> "Père › Mère".
function relationLabel(gen, idx) {
  if (gen === 0) return "Sujet";
  const parts = [];
  for (let b = gen - 1; b >= 0; b--) parts.push((idx >> b) & 1 ? "Père" : "Mère");
  return parts.join(" › ");
}

// Flatten the {animal, mere, pere} tree into generations: gens[g] has 2^g slots.
function collectGenerations(root, maxGen) {
  const gens = [];
  let level = [root];
  for (let g = 0; g <= maxGen; g++) {
    gens.push(level.map((n) => (n ? n.animal : null)));
    const next = [];
    for (const n of level) {
      next.push(n ? n.mere : null);
      next.push(n ? n.pere : null);
    }
    level = next;
  }
  return gens;
}

export default function AnimalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [animal, setAnimal] = useState(null);
  const [pedigree, setPedigree] = useState(null);
  const [lot, setLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLot(null);

    const cache = new Map();
    const fetchAnimal = (aid) => {
      if (!aid) return Promise.resolve(null);
      if (!cache.has(aid)) cache.set(aid, getJSON(`${API_BASE}/api/animals/${aid}`).catch(() => null));
      return cache.get(aid);
    };
    const buildNode = async (aid, depth) => {
      const a = await fetchAnimal(aid);
      if (!a) return null;
      let mere = null;
      let pere = null;
      if (depth > 0) {
        [mere, pere] = await Promise.all([
          buildNode(a.mere_id, depth - 1),
          buildNode(a.pere_id, depth - 1),
        ]);
      }
      return { animal: a, mere, pere };
    };

    try {
      const tree = await buildNode(id, GENERATIONS - 1);
      if (!tree) {
        setError("Animal introuvable.");
        setAnimal(null);
        setPedigree(null);
        return;
      }
      setAnimal(tree.animal);
      setPedigree(tree);
      if (tree.animal.lot_id) {
        getJSON(`${API_BASE}/api/lots/${tree.animal.lot_id}`)
          .then((l) => setLot(l))
          .catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const gens = useMemo(
    () => (pedigree ? collectGenerations(pedigree, GENERATIONS - 1) : []),
    [pedigree]
  );
  const hasAncestors = gens.slice(1).some((g) => g.some(Boolean));

  if (loading) {
    return (
      <div className="animal-page">
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <p className="state">Chargement…</p>
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="animal-page">
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <p className="state state--error">{error || "Animal introuvable."}</p>
      </div>
    );
  }

  const age = ageLabel(animal.date_naissance);
  const cols = GENERATIONS;
  const leafRows = 2 ** (GENERATIONS - 1);
  const headers = ["Sujet", "Parents", "Grands-parents", "Arrière-grands-parents"].slice(0, cols);
  const gridColsStyle = { gridTemplateColumns: `repeat(${cols}, minmax(150px, 1fr))` };

  return (
    <div className="animal-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Retour
      </button>

      {/* ── Header ─────────────────────────── */}
      <header className="animal-header">
        <div>
          <p className="eyebrow">Animal</p>
          <h1 className="page-title mono">{animal.numero_rfid ?? "Sans RFID"}</h1>
          {animal.numero_legal && (
            <p className="page-subtitle mono">N° légal · {animal.numero_legal}</p>
          )}
        </div>
        <div className="animal-tags">
          {animal.status && (
            <span className={`tag tag-${animal.status.toLowerCase()}`}>{animal.status}</span>
          )}
          {animal.etat && (
            <span className={`tag tag-${animal.etat.toLowerCase()}`}>{animal.etat}</span>
          )}
        </div>
        <ChangerLotButton animal={animal} onChanged={reload} />
      </header>

      {/* ── Identité ───────────────────────── */}
      <section className="card">
        <div className="card-head"><h2>Identité</h2></div>
        <dl className="detail-grid">
          <Field label="Sexe" value={SEXE_LABEL[animal.sexe] ?? "—"} />
          <Field label="Race" value={animal.race ?? "—"} />
          <Field label="Date de naissance" value={fmtDate(animal.date_naissance)} />
          <Field label="Âge" value={age ?? "—"} />
          <Field label="Date d'arrivée" value={fmtDate(animal.date_arrivee)} />
          <Field label="Date de sortie" value={fmtDate(animal.date_sortie)} />
          <Field label="Poids" value={animal.poids != null ? `${animal.poids} kg` : "—"} />
          <Field label="Condition corporelle" value={animal.condition_corporelle ?? "—"} />
          <Field
            label="Lot"
            value={
              animal.lot_id ? (
                <Link to={`/lots/${animal.lot_id}`} className="ref-link">
                  <Layers size={13} /> {lot?.nom ?? "Voir le lot"}
                </Link>
              ) : (
                "Aucun lot"
              )
            }
          />
        </dl>
      </section>

      {/* ── Pédigrée ───────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2><GitBranch size={16} /> Pédigrée</h2>
        </div>

        {!hasAncestors ? (
          <p className="state">Aucune filiation renseignée pour cet animal.</p>
        ) : (
          <div className="pedigree-wrap">
            <div className="ped-headers" style={gridColsStyle}>
              {headers.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div
              className="pedigree-grid"
              style={{ ...gridColsStyle, gridTemplateRows: `repeat(${leafRows}, auto)` }}
            >
              {gens.flatMap((arr, g) =>
                arr.map((a, i) => {
                  const span = leafRows / arr.length;
                  const style = {
                    gridColumn: g + 1,
                    gridRow: `${i * span + 1} / span ${span}`,
                  };
                  return (
                    <PedCard
                      key={`${g}-${i}`}
                      animal={a}
                      gen={g}
                      idx={i}
                      style={style}
                      isSubject={g === 0}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>
      <AnimalReproSante animal={animal} lot={lot} onChanged={reload} />
    </div>
  );
}

function PedCard({ animal, gen, idx, style, isSubject }) {
  const female = animal ? animal.sexe === "FEMELLE" : !(idx & 1);
  const cls = [
    "ped-card",
    female ? "is-dam" : "is-sire",
    isSubject ? "is-subject" : "",
    animal ? "" : "is-unknown",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span className="ped-rel">{relationLabel(gen, idx)}</span>
      <span className="ped-rfid mono">{animal ? animal.numero_rfid ?? "—" : "Inconnu"}</span>
      {animal && (
        <span className="ped-meta">
          {[animal.race, SEXE_LABEL[animal.sexe]].filter(Boolean).join(" · ") || "—"}
        </span>
      )}
    </>
  );

  if (animal && !isSubject) {
    return (
      <Link to={`/troupeau/${animal.id}`} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}