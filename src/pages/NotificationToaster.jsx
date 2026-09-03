import { useEffect } from "react";
import { X, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { routeDepuisAlerte } from "../utils/notificationRoute";
import "./NotificationToaster.css";

/**
 * Pile de toasts affichée en overlay (coin bas-droit).
 * Purement présentationnel : lit `toasts`/`dismissToast` du context.
 * Monté une seule fois dans le Shell (hors <Outlet>), donc visible sur
 * toutes les pages qui utilisent MainLayout.
 */
export default function NotificationToaster() {
  const { toasts, dismissToast, marquerLue, TOAST_TTL_MS } = useNotifications();
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="notif-toaster" role="region" aria-label="Notifications récentes">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          notif={t}
          ttl={TOAST_TTL_MS}
          onDismiss={() => dismissToast(t.id)}
          onOpen={() => {
            if (!t.lu) marquerLue(t.id); // marque lu + retire des toasts + badge
            const route = routeDepuisAlerte(t.alerte);
            if (route) navigate(route);
            else dismissToast(t.id);
          }}
        />
      ))}
    </div>
  );
}

function ToastItem({ notif, ttl, onDismiss, onOpen }) {
  // Auto-disparition après `ttl` ms. Le timer se relance si l'id change.
  useEffect(() => {
    const id = setTimeout(onDismiss, ttl);
    return () => clearTimeout(id);
  }, [ttl, onDismiss]);

  const priorite = notif.alerte?.priorite?.toLowerCase() ?? "info";

  return (
    <div className={`notif-toast sev-${priorite}`} role="alert">
      <div className="notif-toast-icon">
        <Bell size={16} />
      </div>

      <button className="notif-toast-body" onClick={onOpen}>
        <div className="notif-toast-titre">{notif.alerte?.titre ?? "Notification"}</div>
        {notif.alerte?.message && (
          <div className="notif-toast-message">{notif.alerte.message}</div>
        )}
      </button>

      <button
        className="notif-toast-close"
        onClick={onDismiss}
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
