import { useState, useEffect, useCallback } from "react";
import { BellOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useNotifications } from "../context/NotificationContext";
import {
  routeDepuisAlerte,
  libelleEntite,
  formatDateRelative,
} from "../utils/notificationRoute";
import "./Notifications.css";

const PAGE_SIZE = 30;

const FILTRES = [
  { value: "", label: "Toutes" },
  { value: "false", label: "Non lues" },
  { value: "true", label: "Lues" },
];

/**
 * Page /notifications — cible du "Voir tout" du dropdown.
 * Pagination par curseur (?before=date_creation) : nécessite le support
 * du param `before` côté GET /notifications (voir INTEGRATION.md).
 *
 * La page a sa PROPRE liste paginée (état local) ; le context est utilisé
 * pour le badge et les mutations réseau — les deux copies sont mises à
 * jour ensemble pour rester cohérentes.
 */
export default function Notifications() {
  const { marquerLue, toutMarquerLu, count } = useNotifications();
  const navigate = useNavigate();

  const [filtre, setFiltre] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finAtteinte, setFinAtteinte] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(
    async ({ before = null, reset = false } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (filtre !== "") params.set("lu", filtre);
        if (before) params.set("before", before);

        const res = await fetch(`/api/alertes/notifications?${params}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const page = await res.json();

        setItems((prev) => (reset ? page : [...prev, ...page]));
        setFinAtteinte(page.length < PAGE_SIZE);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [filtre]
  );

  // (Re)chargement à l'arrivée et à chaque changement de filtre
  useEffect(() => {
    setItems([]);
    setFinAtteinte(false);
    fetchPage({ reset: true });
  }, [fetchPage]);

  const chargerPlus = () => {
    const dernier = items[items.length - 1];
    if (dernier) fetchPage({ before: dernier.date_creation });
  };

  const onClickNotification = (n) => {
    if (!n.lu) {
      marquerLue(n.id); // réseau + badge + copie du dropdown
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x))
      );
    }
    const route = routeDepuisAlerte(n.alerte);
    if (route) navigate(route);
  };

  const onToutMarquerLu = () => {
    toutMarquerLu(); // réseau + badge + copie du dropdown
    setItems((prev) => prev.map((n) => ({ ...n, lu: true })));
  };

  return (
    <div className="page notifications-page">
      <header className="notifications-page-header">
        <h1>Notifications</h1>
        {count > 0 && (
          <button className="btn-secondary" onClick={onToutMarquerLu}>
            Tout marquer lu
          </button>
        )}
      </header>

      <div className="notifications-filtres" role="tablist">
        {FILTRES.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filtre === f.value}
            className={`notif-filtre ${filtre === f.value ? "actif" : ""}`}
            onClick={() => setFiltre(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="notifications-vide">
          <BellOff size={28} />
          <p>
            {filtre === "false"
              ? "Aucune notification non lue."
              : "Aucune notification."}
          </p>
        </div>
      )}

      <ul className="notifications-liste">
        {items.map((n) => {
          const entite = libelleEntite(n.alerte);
          return (
            <li key={n.id}>
              <button
                className={[
                  "notif-item",
                  "notif-item-page",
                  `sev-${n.alerte?.priorite?.toLowerCase() ?? "info"}`,
                  n.lu ? "lue" : "non-lue",
                ].join(" ")}
                onClick={() => onClickNotification(n)}
              >
                <div className="notif-item-page-main">
                  <div className="notif-titre">{n.alerte.titre}</div>
                  <div className="notif-message">{n.alerte.message}</div>
                  {entite && <div className="notif-entite">{entite}</div>}
                </div>
                <time className="notif-date">
                  {formatDateRelative(n.date_creation)}
                </time>
              </button>
            </li>
          );
        })}
      </ul>

      {loading && (
        <p className="notifications-chargement">
          <Loader2 size={16} className="spin" /> Chargement…
        </p>
      )}

      {!loading && !finAtteinte && items.length > 0 && (
        <div className="notifications-charger-plus">
          <button className="btn-secondary" onClick={chargerPlus}>
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
}
