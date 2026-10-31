import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setState, useStore, type MenuItem } from "../state/store";

interface MenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  /** Title-bar menus: ArrowLeft/ArrowRight move to the neighbouring menu. */
  onNavigate?: (direction: -1 | 1) => void;
  /** Elements that toggle this menu themselves; pressing them must not close it first. */
  ignoreRef?: React.RefObject<HTMLElement | null>;
  label?: string;
}

/**
 * A floating menu used for title-bar menus and right-click context menus.
 *
 * It is rendered into <body> through a portal, never inside the title bar:
 * the title bar is a window-drag region (-webkit-app-region: drag), and on
 * Windows real mouse clicks inside a drag region go to the operating system
 * (to move the window) instead of to the page, so menu items there could not
 * be clicked.
 */
export function Menu({ x, y, items, onClose, onNavigate, ignoreRef, label }: MenuProps) {
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
  }, [x, y, items.length]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || ignoreRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      const buttons = [
        ...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
      ];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const focus = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          event.stopPropagation();
          onClose();
          break;
        case "ArrowDown":
          event.preventDefault();
          event.stopPropagation();
          focus(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          event.stopPropagation();
          focus(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focus(0);
          break;
        case "End":
          event.preventDefault();
          focus(-1);
          break;
        case "ArrowLeft":
        case "ArrowRight":
          if (onNavigate) {
            event.preventDefault();
            event.stopPropagation();
            onNavigate(event.key === "ArrowLeft" ? -1 : 1);
          }
          break;
        case "Tab":
          event.preventDefault();
          onClose();
          break;
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
  }, [onClose, onNavigate, ignoreRef]);

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      aria-label={label}
      data-testid="menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={index} className="menu-separator" role="separator" />
        ) : (
          <button
            key={index}
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            aria-label={item.label}
            aria-keyshortcuts={item.shortcut || undefined}
            className={`menu-item${item.danger ? " danger" : ""}`}
            disabled={item.disabled}
            onMouseEnter={(e) => e.currentTarget.focus()}
            onClick={() => {
              onClose();
              item.run?.();
            }}
          >
            <span className="check">{item.checked && <Check size={13} />}</span>
            <span className="label">{item.label}</span>
            {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
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
