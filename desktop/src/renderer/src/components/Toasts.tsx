import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { dismissToast } from "../actions/notify";
import { useStore } from "../state/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          {toast.kind === "error" ? (
            <CircleAlert size={16} color="var(--danger)" />
          ) : toast.kind === "success" ? (
            <CircleCheck size={16} color="var(--success)" />
          ) : (
            <Info size={16} color="var(--accent-text)" />
          )}
          <div className="toast-body">
            <div>{toast.message}</div>
            {toast.detail && <div className="toast-detail">{toast.detail}</div>}
            {toast.actions?.length ? (
              <div className="toast-actions">
                {toast.actions.map((action, index) => (
                  <button
                    key={action.label}
                    className={`btn${index === 0 ? "" : " secondary"}`}
                    onClick={() => {
                      dismissToast(toast.id);
                      action.run();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button className="icon-button" title="Dismiss" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
