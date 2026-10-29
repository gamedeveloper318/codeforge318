import { basename } from "node:path";

/** Turns low-level Node.js filesystem errors into messages a person can act on. */
export function friendlyFsError(error: unknown, action: string, target: string): Error {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  const name = basename(target) || target;
  switch (code) {
    case "ENOENT":
      return new Error(`Could not ${action} "${name}": it no longer exists.`);
    case "EEXIST":
      return new Error(
        `Could not ${action} "${name}": a file or folder with that name already exists.`,
      );
    case "EACCES":
    case "EPERM":
      return new Error(`Could not ${action} "${name}": permission denied.`);
    case "EBUSY":
      return new Error(`Could not ${action} "${name}": it is in use by another program.`);
    case "ENOSPC":
      return new Error(`Could not ${action} "${name}": the disk is full.`);
    case "EISDIR":
      return new Error(`Could not ${action} "${name}": it is a folder.`);
    case "ENOTEMPTY":
      return new Error(`Could not ${action} "${name}": the folder is not empty.`);
    case "EROFS":
      return new Error(`Could not ${action} "${name}": the drive is read-only.`);
    default:
      return error instanceof Error ? error : new Error(`Could not ${action} "${name}".`);
  }
}
