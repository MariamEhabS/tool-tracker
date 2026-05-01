/**
 * @fileoverview Centralized map of named icons to their BoxIcons CSS class strings.
 * Components reference icons by name rather than hardcoding class strings.
 */

export type IconName =
  | "qr"
  | "qrScan"
  | "home"
  | "folder"
  | "file"
  | "image"
  | "pdf"
  | "doc"
  | "wrench"
  | "layer"
  | "collection"
  | "upload"
  | "edit"
  | "download"
  | "trash"
  | "leftArrow"
  | "chevronRight"
  | "chevronDown"
  | "dots"
  | "mapPin"
  | "plus"
  | "plusCircle"
  | "grid"
  | "cog"
  | "lock"
  | "linkExternal"
  | "info"
  | "help"
  | "task";

/** Map of semantic icon names to BoxIcons CSS class strings. */
export const icons: Record<IconName, string> = {
  qr: "bx bx-qr",
  qrScan: "bx bx-qr-scan",
  home: "bx bx-home-alt",
  folder: "bx bx-folder",
  file: "bx bx-file",
  image: "bx bx-image-alt",
  pdf: "bx bxs-file-pdf",
  doc: "bx bxs-file-doc",
  wrench: "bx bx-wrench",
  layer: "bx bx-layer",
  collection: "bx bx-collection",
  upload: "bx bx-upload",
  edit: "bx bx-pencil",
  download: "bx bx-download",
  trash: "bx bx-trash",
  leftArrow: "bx bx-left-arrow-alt",
  chevronRight: "bx bx-chevron-right",
  chevronDown: "bx bx-chevron-down",
  dots: "bx bx-dots-vertical-rounded",
  mapPin: "bx bx-map-pin",
  plus: "bx bx-plus",
  plusCircle: "bx bx-plus-circle",
  grid: "bx bx-grid-alt",
  cog: "bx bx-cog",
  lock: "bx bx-lock-alt",
  linkExternal: "bx bx-link-external",
  info: "bx bx-info-circle",
  help: "bx bx-help-circle",
  task: "bx bx-task",
};
