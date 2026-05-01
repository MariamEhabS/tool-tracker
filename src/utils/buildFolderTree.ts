import type { FolderOption } from "@components/modal/taliho/MoveModal";

/**
 * Shape of the raw folder objects from qrData.folders (QRCodeAggregate).
 * Only the fields needed for tree-building are listed.
 */
type RawFolder = {
  _id: string;
  folderName: string;
  subfolders: string[];
  linkedFiles?: Array<{ _id?: string; id?: string }>;
  deleted?: boolean;
  status?: string;
  permissions?: { write?: boolean };
};

/**
 * Build a depth-first ordered flat list of FolderOption with hierarchy metadata.
 *
 * Traverses the folder array using `subfolders` references to determine
 * parent-child relationships.  Output order: each parent is immediately
 * followed by its children (recursively), so a flat renderer can indent by
 * the `depth` field.
 */
export function buildFolderTree(folders: RawFolder[]): FolderOption[] {
  if (!Array.isArray(folders) || folders.length === 0) return [];

  const byId = new Map<string, RawFolder>();
  for (const f of folders) {
    byId.set(f._id, f);
  }

  // Collect all IDs that appear as a child of some other folder
  const childIds = new Set<string>();
  for (const f of folders) {
    for (const cid of f.subfolders ?? []) {
      childIds.add(cid);
    }
  }

  // Root folders are those NOT referenced as a child anywhere
  const roots = folders.filter((f) => !childIds.has(f._id));

  const result: FolderOption[] = [];
  const visited = new Set<string>();

  function walk(folder: RawFolder, depth: number, parentId: string | null) {
    if (visited.has(folder._id)) return; // circular-reference guard
    visited.add(folder._id);

    const hasChildren =
      Array.isArray(folder.subfolders) && folder.subfolders.length > 0;

    result.push({
      value: folder._id,
      label: folder.folderName || "Unnamed Folder",
      deleted: folder.deleted || folder.status === "deleted",
      canWrite: folder.permissions?.write !== false,
      permissions: folder.permissions,
      parentId,
      depth,
      hasChildren,
    });

    if (hasChildren) {
      for (const cid of folder.subfolders) {
        const child = byId.get(cid);
        if (child) walk(child, depth + 1, folder._id);
      }
    }
  }

  for (const root of roots) {
    walk(root, 0, null);
  }

  return result;
}

/**
 * Find which folder a document lives in by checking each folder's
 * `linkedFiles` array.  Returns the folder _id, or null if the
 * document is at root level (not inside any folder).
 */
export function findDocumentFolder(
  folders: RawFolder[],
  documentId: string,
): string | null {
  if (!Array.isArray(folders) || !documentId) return null;

  for (const f of folders) {
    const linked = f.linkedFiles;
    if (!Array.isArray(linked)) continue;
    const found = linked.some((doc) => (doc._id ?? doc.id) === documentId);
    if (found) return f._id;
  }

  return null;
}
