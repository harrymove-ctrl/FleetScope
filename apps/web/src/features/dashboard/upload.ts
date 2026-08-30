/** Small, pure helpers shared by the dashboard upload handoff and its tests. */

export const SESSION_FILE_RE = /\.(jsonl|json)$/i;

export interface UploadFileLike {
  readonly name: string;
  readonly size: number;
  readonly webkitRelativePath?: string;
}

export interface DashboardCompanion {
  readonly name: string;
  readonly text: string;
}

export interface DashboardHandoff {
  readonly name: string;
  readonly main: string;
  readonly companions: readonly DashboardCompanion[];
  readonly createdAt: number;
}

export function isReadableSession(name: string): boolean {
  return SESSION_FILE_RE.test(name);
}

export function filePath(file: UploadFileLike): string {
  return file.webkitRelativePath || file.name;
}

export function sessionRoot(file: UploadFileLike): string {
  return filePath(file).replace(/\.[^./]+$/, '');
}

/** Pick the shallowest, largest transcript just like the Viewer does. */
export function pickMainFile<T extends UploadFileLike>(files: readonly T[]): T | null {
  const readable = files.filter((file) => isReadableSession(file.name));
  if (readable.length === 0) return null;
  const shallowest = Math.min(...readable.map((file) => filePath(file).split('/').length));
  const candidates = readable.filter((file) => filePath(file).split('/').length === shallowest);
  return candidates.reduce((largest, file) => (file.size > largest.size ? file : largest));
}

export function companionName(file: UploadFileLike, main: UploadFileLike): string {
  const path = filePath(file);
  const root = sessionRoot(main);
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}
