/**
 * @fileoverview Route path builder functions for consistent navigation.
 * Use these instead of hardcoding path strings in components.
 */

/** Returns the path to a project detail page. */
export function toProject(id: string) {
  return `/project/${id}`;
}

/** Returns the path to an arrangement (group) detail page. */
export function toArrangement(id: string) {
  return `/group/${id}`;
}

/** Returns the path to an equipment (group) detail page. */
export function toEquipment(id: string) {
  return `/group/${id}`;
}

/** Returns the path to a group detail page. */
export function toGroup(id: string) {
  return `/group/${id}`;
}

/** Returns the path to a QR code detail page. */
export function toQRCode(id: string) {
  return `/qrcode/${id}`;
}

export function toCreateQR() {
  return `/create-qr`;
}

export function toProjects() {
  return `/projects`;
}

export function toArrangements() {
  return `/groups`;
}

export function toEquipments() {
  return `/groups`;
}

export function toMyQRCodes() {
  return `/my-qrcodes`;
}

export function toDashboard() {
  return `/dashboard`;
}

export function toSettings() {
  return `/settings`;
}
