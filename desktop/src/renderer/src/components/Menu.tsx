import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { setState, useStore, type MenuItem } from "../state/store";

interface MenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

/** A floating menu used for title-bar menus and right-click context menus. */
export function Menu({ x, y, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      x: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? index + 1 : index - 1;
        buttons[(next + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener("mousedown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="menu" role="menu" style={{ left: position.x, top: position.y }}>
      {items.map((item, index) =>
        item.separator ? (
          <div key={index} className="menu-separator" role="separator" />
        ) : (
          <button
            key={index}
            role="menuitem"
            className={`menu-item${item.danger ? " danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.run?.();
            }}
          >
            <span className="label">{item.label}</span>
            {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** Renders the global right-click menu from the store. */
export function ContextMenuHost() {
  const menu = useStore((s) => s.contextMenu);
  if (!menu) return null;
  return (
    <Menu
      x={menu.x}
      y={menu.y}
      items={menu.items}
      onClose={() => setState({ contextMenu: null })}
    />
  );
}

export function openContextMenu(event: React.MouseEvent, items: MenuItem[]): void {
  event.preventDefault();
  event.stopPropagation();
  setState({ contextMenu: { x: event.clientX, y: event.clientY, items } });
}
