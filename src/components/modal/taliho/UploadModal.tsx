import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  useCallback,
} from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";
import { handleModalError } from "@/utils/modalErrorHandler";

export type UploadItem =
  | {
      kind: "file";
      id: string;
      file: File;
      displayName: string;
      relativePath?: string;
      parentFolderId?: string;
      openToPage?: number;
    }
  | {
      kind: "url";
      id: string;
      url: string;
      displayName: string;
      parentFolderId?: string;
    }
  | {
      kind: "folder";
      id: string;
      displayName: string;
      parentFolderId?: string;
    };

type UploadModalProps = {
  open: boolean;
  onConfirm: (files: File[], allItems?: UploadItem[]) => void | Promise<void>;
  onClose: () => void;
  /** Optional explicit title; default: "Upload Document(s)" */
  title?: string;
  /** Optional explicit subtitle; if omitted and subjectLabel is provided, a default is composed */
  subtitle?: ReactNode;
  /** Subject used to compose default subtitle, e.g., "arrangement", "equipment" */
  subjectLabel?: string;
  /** Accept attribute for input */
  accept?: string;
  /** Allow selecting multiple files; default true */
  multiple?: boolean;
  /** Labels */
  inputLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Helper text under input */
  helperText?: string;
  /** Optional input id (for label association) */
  inputId?: string;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  /** Optional initial files injected by parent (e.g., from external drop) */
  initialFiles?: Array<{ file: File; relPath?: string }>;
};

export default function UploadModal(props: UploadModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    title = "Upload Document(s)",
    subtitle,
    subjectLabel,
    accept = ".pdf,.doc,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip,.mp4,.mov,.avi,.mkv,.webm,video/*",
    multiple = true,
    confirmLabel = "Upload",
    cancelLabel = "Cancel",
    inputId = "upload-input",
    size = "3xl",
    initialFiles,
  } = props;

  const [items, setItems] = useState<UploadItem[]>([]);
  const [, /* isDragging */ setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasConsumedInitialRef = useRef<boolean>(false);
  // Inputs removed for compact cards; keep no local state

  // Drag & drop reordering and grouping state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<
    "before" | "inside" | "after" | null
  >(null);
  const [rootDropPos, setRootDropPos] = useState<null | "top" | "bottom">(null);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function markEntering(ids: string[]) {
    if (ids.length === 0) return;
    setEnteringIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    window.setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 30);
  }

  function markRemoving(id: string) {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setItems((prev) => prev.filter((p) => p.id !== id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  // helper kept for potential future use; current removal uses inline handler

  function getItemById(id: string | null): UploadItem | undefined {
    if (!id) return undefined;
    return items.find((i) => i.id === id);
  }

  function moveItem(
    dragId: string,
    targetId: string,
    position: "before" | "inside" | "after",
  ) {
    if (dragId === targetId) return;
    const dragItem = getItemById(dragId);
    const targetItem = getItemById(targetId);
    if (!dragItem || !targetItem) return;

    setItems((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((i) => i.id === dragId);
      if (fromIdx < 0) return prev;
      const [removed] = list.splice(fromIdx, 1);

      // Helper: guard against nesting a folder into its own descendant
      function isDescendant(
        l: UploadItem[],
        maybeDescendantId: string,
        maybeAncestorId: string,
      ): boolean {
        let cur: UploadItem | undefined = l.find(
          (i) => i.id === maybeDescendantId,
        );
        const guard = new Set<string>();
        while (cur && cur.parentFolderId) {
          if (cur.parentFolderId === maybeAncestorId) return true;
          if (guard.has(cur.parentFolderId)) break;
          guard.add(cur.parentFolderId);
          cur = l.find((i) => i.id === cur?.parentFolderId);
        }
        return false;
      }

      // If inside and target is folder, assign parent for all item kinds,
      // but prevent folder -> its own descendant nesting cycles
      if (position === "inside" && targetItem.kind === "folder") {
        if (
          removed.kind === "folder" &&
          isDescendant(list, targetItem.id, removed.id)
        ) {
          // Fallback: treat as 'after' the target
          removed.parentFolderId = targetItem.parentFolderId;
          const toIdxFallback = list.findIndex((i) => i.id === targetItem.id);
          list.splice(toIdxFallback + 1, 0, removed);
          return list;
        }
        removed.parentFolderId = targetItem.id;
        const toIdxFolder = list.findIndex((i) => i.id === targetItem.id);
        const insertIdx = toIdxFolder + 1;
        list.splice(insertIdx, 0, removed);
        return list;
      }

      // Otherwise reorder around target and adopt target's parent (root when undefined)
      removed.parentFolderId = targetItem.parentFolderId;
      const toIdx = list.findIndex((i) => i.id === targetItem.id);
      let insertIdx = toIdx;
      if (position === "after") insertIdx = toIdx + 1;
      if (position === "before") insertIdx = toIdx;
      list.splice(insertIdx, 0, removed);
      return list;
    });
  }

  function moveToRoot(dragId: string, pos: "top" | "bottom") {
    const dragItem = getItemById(dragId);
    if (!dragItem) return;
    setItems((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((i) => i.id === dragId);
      if (fromIdx < 0) return prev;
      const [removed] = list.splice(fromIdx, 1);
      removed.parentFolderId = undefined;
      if (pos === "top") {
        // Insert before first root-level item if any; else at 0
        const firstRootIdx = list.findIndex((i) => !i.parentFolderId);
        const insertIdx = firstRootIdx >= 0 ? firstRootIdx : 0;
        list.splice(insertIdx, 0, removed);
      } else {
        // Insert after last root-level item; if none, push to end
        let lastRootIdx = -1;
        for (let i = list.length - 1; i >= 0; i -= 1) {
          if (!list[i].parentFolderId) {
            lastRootIdx = i;
            break;
          }
        }
        const insertIdx = lastRootIdx >= 0 ? lastRootIdx + 1 : list.length;
        list.splice(insertIdx, 0, removed);
      }
      return list;
    });
  }

  const canSubmit = useMemo(() => items.length > 0, [items]);

  function getFileExtension(name: string): string {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx).toLowerCase() : "";
  }

  const createAcceptPredicate = useCallback((acceptStr?: string) => {
    if (!acceptStr) return () => true;
    const tokens = acceptStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const extensions = new Set<string>();
    const mimeTypes = new Set<string>();
    const mimeWildcards: string[] = []; // e.g., 'image/' for 'image/*'
    for (const t of tokens) {
      if (t.startsWith(".")) extensions.add(t.toLowerCase());
      else if (t.endsWith("/*") && t.includes("/"))
        mimeWildcards.push(t.slice(0, t.length - 1).toLowerCase());
      else if (t.includes("/")) mimeTypes.add(t.toLowerCase());
    }
    return (file: File) => {
      const type = (file.type || "").toLowerCase();
      if (type) {
        if (mimeTypes.has(type)) return true;
        if (mimeWildcards.some((prefix) => type.startsWith(prefix)))
          return true;
      }
      const ext = getFileExtension(file.name);
      if (ext && extensions.has(ext)) return true;
      // If no explicit match, disallow
      return (
        extensions.size === 0 &&
        mimeTypes.size === 0 &&
        mimeWildcards.length === 0
      );
    };
  }, []);

  const acceptPredicate = useMemo(
    () => createAcceptPredicate(accept),
    [accept, createAcceptPredicate],
  );

  const mergeItems = useCallback(
    (previous: UploadItem[], incoming: UploadItem[]): UploadItem[] => {
      if (!multiple) return incoming.length > 0 ? [incoming[0]] : [];
      const seen = new Set(previous.map((i) => i.id));
      const toAppend = incoming.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
      return [...previous, ...toAppend];
    },
    [multiple],
  );

  const handleFilesSelected = useCallback(
    (
      list: FileList | File[],
      relativePathGetter?: (f: File) => string | undefined,
    ) => {
      const arr = Array.from(list);
      const filtered = arr.filter((f) => acceptPredicate(f));
      const incoming: UploadItem[] = filtered.map((f) => ({
        kind: "file",
        id: `file-${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        displayName: f.name,
        relativePath: relativePathGetter
          ? relativePathGetter(f)
          : (f as unknown as { webkitRelativePath?: string })
              .webkitRelativePath,
      }));
      markEntering(incoming.map((i) => i.id));
      setItems((prev) => mergeItems(prev, incoming));
    },
    [acceptPredicate, mergeItems],
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) {
      setItems([]);
      return;
    }
    handleFilesSelected(list);
  }

  // Consume initial files provided by parent exactly once per open
  useEffect(() => {
    if (!open) {
      hasConsumedInitialRef.current = false;
      return;
    }
    if (
      initialFiles &&
      initialFiles.length > 0 &&
      !hasConsumedInitialRef.current
    ) {
      const files = initialFiles.map((c) => c.file);
      const getter = (f: File) =>
        initialFiles.find((c) => c.file === f)?.relPath;
      handleFilesSelected(files, getter);
      hasConsumedInitialRef.current = true;
    }
  }, [open, initialFiles, handleFilesSelected]);

  // Best-effort support for dropping folders by traversing DataTransferItem entries (webkit API)
  // Minimal DOM types for webkit directory entries
  type FileSystemEntry = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
  };
  type FileSystemFileEntry = FileSystemEntry & {
    file: (
      success: (file: File) => void,
      error?: (err: DOMException) => void,
    ) => void;
  };
  type FileSystemDirectoryReader = {
    readEntries: (
      success: (entries: FileSystemEntry[]) => void,
      error?: (err: DOMException) => void,
    ) => void;
  };
  type FileSystemDirectoryEntry = FileSystemEntry & {
    createReader: () => FileSystemDirectoryReader;
  };

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const itemsList = dt.items;
    const filesList = dt.files;
    const collected: Array<{ file: File; relPath?: string }> = [];

    const traverseEntry = (
      entry: FileSystemEntry,
      path: string,
    ): Promise<void> => {
      return new Promise((resolve) => {
        if (!entry) {
          resolve();
          return;
        }
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file(
            (file: File) => {
              collected.push({ file, relPath: path + file.name });
              resolve();
            },
            () => resolve(),
          );
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const entries: FileSystemEntry[] = [];
          const readBatch = () => {
            reader.readEntries(
              (batch: FileSystemEntry[]) => {
                if (!batch.length) {
                  Promise.all(
                    entries.map((en) =>
                      traverseEntry(en, path + entry.name + "/"),
                    ),
                  ).then(() => resolve());
                } else {
                  entries.push(...batch);
                  readBatch();
                }
              },
              () => resolve(),
            );
          };
          readBatch();
        } else {
          resolve();
        }
      });
    };

    const hasItems = itemsList && itemsList.length > 0;
    if (hasItems) {
      const tasks: Promise<void>[] = [];
      for (let i = 0; i < itemsList.length; i += 1) {
        const it = itemsList[i];
        type WebkitEntry = { webkitGetAsEntry?: () => FileSystemEntry | null };
        const entry = (it as WebkitEntry).webkitGetAsEntry
          ? (it as WebkitEntry).webkitGetAsEntry?.()
          : null;
        if (entry) tasks.push(traverseEntry(entry, ""));
        else {
          const f = it.getAsFile();
          if (f) collected.push({ file: f });
        }
      }
      await Promise.all(tasks);
      const fileArray = collected.map((c) => c.file);
      handleFilesSelected(
        fileArray,
        (f) => collected.find((c) => c.file === f)?.relPath,
      );
      return;
    }
    // Fallback: files list
    if (filesList && filesList.length > 0) {
      handleFilesSelected(filesList);
    }
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  }

  async function handleConfirm() {
    if (!canSubmit || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await Promise.resolve(
        onConfirm(
          items.filter((it) => it.kind === "file").map((it) => it.file),
          items,
        ),
      );
      // Clear items only on successful upload so next open starts fresh
      setItems([]);
    } catch (error) {
      handleModalError(error, {
        action: "upload-modal-failed",
        userMessage: "Upload failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const computedSubtitle =
    subtitle ??
    (subjectLabel ? (
      <span>Select one or more files to add to this {subjectLabel}.</span>
    ) : undefined);

  // Configure hidden input: file input (files only)
  useEffect(() => {
    const fileEl = inputRef.current;
    if (fileEl) {
      fileEl.removeAttribute("webkitdirectory");
      fileEl.removeAttribute("directory");
      fileEl.setAttribute("multiple", multiple ? "" : "");
    }
  }, [multiple, open]);

  const modalSize = size === "3xl" ? "2xl" : size;

  // Helpers for nested folder rendering
  function getChildren(folderId: string): UploadItem[] {
    return items.filter((i) => i.parentFolderId === folderId);
  }

  function renderItem(it: UploadItem) {
    const isFolder = it.kind === "folder";
    const isTarget = dropTargetId === it.id;
    const showTopLine = isTarget && dropPosition === "before";
    const showBottomLine = isTarget && dropPosition === "after";
    const showInsideHighlight =
      isTarget && dropPosition === "inside" && isFolder;

    const children = isFolder ? getChildren(it.id) : [];

    return (
      <li
        key={it.id}
        className={`group transition-all duration-200 ease-in-out ${enteringIds.has(it.id) ? "opacity-0 -translate-y-2" : removingIds.has(it.id) ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggingId(it.id);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          setDraggingId(null);
          setDropTargetId(null);
          setDropPosition(null);
          setRootDropPos(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggingId && draggingId !== it.id) {
            setDropTargetId(it.id);
            const rect = (
              e.currentTarget as HTMLLIElement
            ).getBoundingClientRect();
            const y = e.clientY - rect.top;
            if (isFolder) {
              const threshold = 10; // px band at top/bottom reserved for before/after
              if (y <= threshold) setDropPosition("before");
              else if (y >= rect.height - threshold) setDropPosition("after");
              else setDropPosition("inside");
            } else {
              setDropPosition(y < rect.height * 0.5 ? "before" : "after");
            }
            setRootDropPos(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggingId && dropTargetId && dropPosition) {
            moveItem(draggingId, dropTargetId, dropPosition);
          }
          setDraggingId(null);
          setDropTargetId(null);
          setDropPosition(null);
          setRootDropPos(null);
        }}
      >
        {showTopLine ? (
          <div className="mb-2">
            <div className="h-6 border-2 border-dashed border-brand-300 rounded bg-brand-50/40"></div>
          </div>
        ) : null}
        <div
          className={`bg-white border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition ${showInsideHighlight ? "ring-2 ring-brand-400" : ""}`}
        >
          {it.kind === "file" ? (
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-start gap-2">
                <i className="bx bx-file text-gray-500 text-lg pt-1 w-4.5"></i>
                <i className="bx bx-dots-vertical-rounded text-gray-400 text-xl mt-1 w-4.5 cursor-grab"></i>
              </div>
              <div className="flex-1 space-y-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={it.displayName}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === it.id
                              ? { ...p, displayName: e.target.value }
                              : p,
                          ),
                        )
                      }
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                      placeholder="Enter display name"
                    />
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <label className="block text-[11px] font-medium text-gray-600">
                      Original Name
                    </label>
                    <p className="grow text-[11px] text-gray-500 inline-flex items-center gap-1">
                      {it.relativePath ? it.relativePath : it.file.name}{" "}
                      <span className="text-gray-400">
                        (
                        {it.file && typeof it.file.size === "number"
                          ? it.file.size < 10_240
                            ? `${Math.ceil(it.file.size / 1024)} KB`
                            : `${(it.file.size / 1024 / 1024).toFixed(1)} MB`
                          : "-"}{" "}
                        )
                      </span>
                    </p>
                  </div>
                </div>
                {it.file.name.toLowerCase().endsWith(".pdf") && (
                  <div className="mt-1.5">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Open to page
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={it.openToPage ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const parsed = val ? parseInt(val, 10) : undefined;
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === it.id
                              ? {
                                  ...p,
                                  openToPage:
                                    parsed && parsed > 0 ? parsed : undefined,
                                }
                              : p,
                          ),
                        );
                      }}
                      className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                      placeholder="1"
                    />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="iconGhost"
                leftIconClass="bx bx-x"
                aria-label="Remove"
                onClick={() => markRemoving(it.id)}
              />
            </div>
          ) : it.kind === "folder" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-start gap-1">
                  <i className="bx bxs-folder text-gray-500 text-lg mt-1 w-4.5"></i>
                  <i className="bx bx-dots-vertical-rounded text-gray-400 text-xl mt-1 w-4.5 cursor-grab"></i>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Folder Name
                    </label>
                    <input
                      type="text"
                      value={it.displayName}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === it.id
                              ? { ...p, displayName: e.target.value }
                              : p,
                          ),
                        )
                      }
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                      placeholder="e.g., Taliho Documents"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="iconGhost"
                  leftIconClass="bx bx-x"
                  aria-label="Remove"
                  onClick={() => markRemoving(it.id)}
                />
              </div>
              {showInsideHighlight ? (
                <div className="h-6 border-2 border-dashed border-brand-300 rounded bg-brand-50/40"></div>
              ) : null}
              {children.length > 0 ? (
                <ul className="space-y-2 pl-4 ml-2 border-l border-gray-200">
                  {children.map((child) => renderItem(child))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-start gap-1">
                <i className="bx bx-link-alt text-gray-500 text-lg mt-1 w-4.5"></i>
                <i className="bx bx-dots-vertical-rounded text-gray-400 text-xl mt-1 w-4.5 cursor-grab"></i>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={it.displayName}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p) =>
                          p.id === it.id
                            ? { ...p, displayName: e.target.value }
                            : p,
                        ),
                      )
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                    placeholder="e.g., Company Website"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={(it as Extract<UploadItem, { kind: "url" }>).url}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p) =>
                          p.id === it.id
                            ? ({
                                ...(p as Extract<UploadItem, { kind: "url" }>),
                                url: e.target.value,
                              } as UploadItem)
                            : p,
                        ),
                      )
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="iconGhost"
                leftIconClass="bx bx-x"
                aria-label="Remove"
                onClick={() => markRemoving(it.id)}
              />
            </div>
          )}
        </div>
        {showBottomLine ? (
          <div className="my-2">
            <div className="h-6 border-2 border-dashed border-brand-300 rounded bg-brand-50/40"></div>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={computedSubtitle}
      className="max-w-7xl"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              isSubmitting ? "bx bx-loader-alt bx-spin" : "bx bx-upload"
            }
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Uploading…" : confirmLabel}
          </Button>
        </>
      }
      size={modalSize}
    >
      <div className="h-[520px] flex flex-col relative">
        {isSubmitting ? (
          <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-700">
              <i className="bx bx-loader-alt bx-spin text-3xl text-brand-600"></i>
              <div className="text-sm">Uploading your files… Please wait.</div>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full min-h-0">
          <div className="flex flex-col gap-2 h-full overflow-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                Upload files
              </h4>
            </div>
            <div
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => {
                inputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={
                "w-full grow rounded-md border-2 border-dashed border-gray-300 px-6 py-12 transition duration-150 ease-in-out hover:border-gray-400 cursor-pointer flex flex-col items-center justify-center text-center"
              }
            >
              <i className="bx bx-cloud-upload text-4xl text-gray-400"></i>
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium text-yellow-700">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                Multiple files and folders allowed.
              </p>
            </div>
            {/* Hidden input for browse action */}
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              multiple={multiple}
              accept={accept}
              onChange={onInputChange}
              className="sr-only"
            />

            {/* Add Folder section */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                Add Folder
              </h4>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-md bg-yellow-100 text-yellow-700">
                    <i className="bx bxs-folder-plus text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Create a new folder
                    </p>
                    <p className="text-xs text-gray-500">
                      Add a folder to organize uploaded files and URLs.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-folder-plus"
                    onClick={() => {
                      const base = "New Folder";
                      const suffix =
                        items.filter((i) => i.kind === "folder").length + 1;
                      const id = `folder-${Date.now()}`;
                      const name = `${base} ${suffix}`;
                      markEntering([id]);
                      setItems((prev) => [
                        ...prev,
                        { kind: "folder", id, displayName: name },
                      ]);
                    }}
                  >
                    Add folder
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Add URLs</h4>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-md bg-green-100 text-green-700">
                    <i className="bx bx-link-alt text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      Add a URL
                    </p>
                    <p className="text-xs text-gray-500">
                      Add a new link item with editable name and URL in the
                      list.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-link-alt"
                    onClick={() => {
                      const id = `url-${Date.now()}`;
                      markEntering([id]);
                      setItems((prev) => [
                        ...prev,
                        { kind: "url", id, url: "", displayName: "" },
                      ]);
                    }}
                  >
                    Add URL
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="h-full min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-800">
                  Items to Upload
                </h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                  {items.length}
                </span>
              </div>
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setItems([])}
              >
                Clear all
              </button>
            </div>
            <div
              ref={scrollRef}
              className="rounded-lg border border-gray-200 bg-white flex-1 min-h-0 overflow-auto p-3 shadow"
              onDragOverCapture={(e) => {
                if (!draggingId) return;
                const scroller = scrollRef.current;
                if (!scroller) return;
                const rect = scroller.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const margin = 36;
                const maxScroll = scroller.scrollHeight - scroller.clientHeight;
                if (y < margin) {
                  scroller.scrollTop = Math.max(
                    0,
                    scroller.scrollTop - Math.ceil((margin - y) / 3),
                  );
                } else if (y > rect.height - margin) {
                  scroller.scrollTop = Math.min(
                    maxScroll,
                    scroller.scrollTop +
                      Math.ceil((y - (rect.height - margin)) / 3),
                  );
                }
              }}
            >
              <div className="flex flex-col min-h-full">
                <div
                  className="min-h-0"
                  onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setRootDropPos("top");
                    setDropTargetId(null);
                    setDropPosition(null);
                  }}
                  onDrop={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    moveToRoot(draggingId, "top");
                    setDraggingId(null);
                    setRootDropPos(null);
                  }}
                >
                  {rootDropPos === "top" ? (
                    <div className="my-2">
                      <div className="h-6 border-2 border-dashed border-yellow-300 rounded bg-yellow-50/40"></div>
                    </div>
                  ) : null}
                </div>
                {items.length === 0 ? (
                  <div className="grow py-8 flex items-center justify-center">
                    <p className="text-sm text-gray-500">No items added yet.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items
                      .filter((it) => !it.parentFolderId)
                      .map((it) => renderItem(it))}
                  </ul>
                )}
                {items.length > 0 ? (
                  <div
                    className="flex-1"
                    onDragOver={(e) => {
                      if (!draggingId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setRootDropPos("bottom");
                      setDropTargetId(null);
                      setDropPosition(null);
                    }}
                    onDrop={(e) => {
                      if (!draggingId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      moveToRoot(draggingId, "bottom");
                      setDraggingId(null);
                      setRootDropPos(null);
                    }}
                  >
                    {rootDropPos === "bottom" ? (
                      <div className="my-2">
                        <div className="h-6 border-2 border-dashed border-yellow-300 rounded bg-yellow-50/40"></div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
