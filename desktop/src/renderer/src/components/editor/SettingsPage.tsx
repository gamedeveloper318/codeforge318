import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_SETTINGS,
  SETTING_DESCRIPTORS,
  type SettingDescriptor,
  type Settings,
} from "@shared/settings";
import { resetSettings, updateSettings } from "../../actions/misc";
import { useStore } from "../../state/store";

function SettingControl({
  descriptor,
  value,
}: {
  descriptor: SettingDescriptor;
  value: Settings[keyof Settings];
}) {
  const { control, key } = descriptor;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (next: unknown) => void updateSettings({ [key]: next } as Partial<Settings>);

  switch (control.type) {
    case "boolean":
      return (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => commit(e.target.checked)}
          />
          {descriptor.description}
        </label>
      );
    case "enum":
      return (
        <select
          className="text-input"
          value={value as string}
          aria-label={descriptor.label}
          onChange={(e) => commit(e.target.value)}
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          className="text-input"
          aria-label={descriptor.label}
          min={control.min}
          max={control.max}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (draft !== null && Number.isInteger(n) && n >= control.min && n <= control.max)
              commit(n);
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      );
    case "string":
      return (
        <input
          className="text-input"
          aria-label={descriptor.label}
          placeholder={control.placeholder}
          spellCheck={false}
          value={draft ?? (value as string)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null)
              commit(draft.trim() || (key === "terminal.shell" ? "" : DEFAULT_SETTINGS[key]));
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      );
    case "list":
      return (
        <textarea
          className="text-input"
          aria-label={descriptor.label}
          spellCheck={false}
          value={draft ?? (value as string[]).join("\n")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null)
              commit(
                draft
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              );
            setDraft(null);
          }}
        />
      );
  }
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matching = SETTING_DESCRIPTORS.filter(
      (d) =>
        !query ||
        `${d.label} ${d.key} ${d.description} ${d.category}`.toLowerCase().includes(query),
    );
    const byCategory = new Map<string, SettingDescriptor[]>();
    for (const d of matching)
      byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
    return [...byCategory.entries()];
  }, [filter]);

  return (
    <div className="settings-page" data-testid="settings-page">
      <div className="settings-inner">
        <div className="settings-toolbar">
          <input
            className="text-input"
            placeholder="Search settings"
            aria-label="Search settings"
            value={filter}
            autoFocus
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn secondary" onClick={() => void resetSettings()}>
            <RotateCcw size={14} /> Reset all
          </button>
        </div>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Changes apply immediately and are saved automatically.
        </p>
        {groups.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No settings match “{filter}”.</p>
        )}
        {groups.map(([category, descriptors]) => (
          <section key={category}>
            <div className="settings-category">{category}</div>
            {descriptors.map((descriptor) => (
              <div key={descriptor.key} className="setting">
                <div className="setting-label">
                  {descriptor.label}
                  <span className="setting-key">{descriptor.key}</span>
                </div>
                {descriptor.control.type !== "boolean" && (
                  <div className="setting-description">{descriptor.description}</div>
                )}
                <SettingControl descriptor={descriptor} value={settings[descriptor.key]} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
