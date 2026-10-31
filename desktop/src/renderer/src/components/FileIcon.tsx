import { DEFAULT_FILE_ICON, FOLDER_ICON, FOLDER_OPEN_ICON, iconForFile } from "@shared/file-icons";

// Language icons from material-icon-theme (MIT), copied into the app by
// scripts/copy-file-icons.mjs, so they work offline.
const urls = import.meta.glob("../assets/file-icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const ICONS = new Map(
  Object.entries(urls).map(([file, url]) => [file.slice(file.lastIndexOf("/") + 1, -4), url]),
);

function Icon({ id, size }: { id: string; size: number }) {
  const known = ICONS.has(id) ? id : DEFAULT_FILE_ICON;
  return (
    <img
      className="file-icon"
      src={ICONS.get(known)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      data-icon={known}
    />
  );
}

/** The language icon for a file name or path (Python, HTML, JavaScript, ...). */
export function FileIcon({ name, size = 16 }: { name: string; size?: number }) {
  return <Icon id={iconForFile(name)} size={size} />;
}

export function FolderIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  return <Icon id={open ? FOLDER_OPEN_ICON : FOLDER_ICON} size={size} />;
}
