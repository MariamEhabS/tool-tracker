import CreateVCardV2 from "../v2/CreateVCardV2";

/**
 * Legacy V-Card Configure shim.
 *
 * The Business Card flow is now rendered by CreateVCardV2 via the
 * intercept in `routes/create-qr.lazy.tsx`. This component only renders
 * if a code path reaches the wizard's Configure stage without that
 * intercept firing (e.g., a deep-linked legacy URL). Keeping the export
 * means ConfigureView's mapping of `single:vcard → ConfigureVCard` keeps
 * working and there is one source of truth for the UI.
 */
export default function ConfigureVCard() {
  return <CreateVCardV2 />;
}
