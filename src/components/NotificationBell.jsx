import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router";
import { useNotifications } from "../context/NotificationContext";
import {
  routeDepuisAlerte,
  libelleEntite,
  formatDateRelative,
} from "../utils/notificationRoute";
import "./NotificationBell.css";

export default function NotificationBell() {
  const { count, items, loading, ouvrirListe, marquerLue, toutMarquerLu } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) ouvrirListe(); // lazy + refetch seulement si le badge a bougé
  };

  // Fermeture au clic extérieur et à Échap
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onClickNotification = (n) => {
    if (!n.lu) marquerLue(n.id);
    setOpen(false);
    const route = routeDepuisAlerte(n.alerte);
    if (route) navigate(route);
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button
        className="icon-btn notif-bell-btn"
        onClick={toggle}
        aria-label={
          count > 0 ? `Notifications (${count} non lues)` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="notif-badge">{count > 99 ? "99+" : count}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Notifications">
          <header className="notif-dropdown-header">
            <span>Notifications</span>
            {count > 0 && (
              <button className="notif-btn-link" onClick={toutMarquerLu}>
                Tout marquer lu
              </button>
            )}
          </header>

          {loading && <p className="notif-empty">Chargement…</p>}
          {!loading && items?.length === 0 && (
            <p className="notif-empty">Aucune notification.</p>
          )}

          {!loading && items?.length > 0 && (
            <ul className="notif-list">
              {items.map((n) => {
                const entite = libelleEntite(n.alerte);
                return (
                  <li key={n.id}>
                    <button
                      className={[
                        "notif-item",
                        `sev-${n.alerte.severite?.toLowerCase() ?? "info"}`,
                        n.lu ? "lue" : "non-lue",
                      ].join(" ")}
                      onClick={() => onClickNotification(n)}
                    >
                      <div className="notif-titre">{n.alerte.titre}</div>
                      {entite && <div className="notif-entite">{entite}</div>}
                      <time className="notif-date">
                        {formatDateRelative(n.date_creation)}
                      </time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <footer className="notif-dropdown-footer">
            <button
              className="notif-btn-link"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
            >
              Voir tout
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
