import CreateHardHatV2 from "../v2/CreateHardHatV2";

/**
 * Hard Hat Configure shim.
 *
 * The Hard Hat flow is rendered by CreateHardHatV2 via the intercept
 * in `routes/create-qr.lazy.tsx`. This component only renders if a
 * code path reaches the wizard's Configure stage without that
 * intercept firing (e.g., a deep-linked legacy URL). Keeping the
 * export means ConfigureView's mapping of `single:hard-hat →
 * ConfigureHardHat` keeps working and there is one source of truth
 * for the UI.
 */
export default function ConfigureHardHat() {
  return <CreateHardHatV2 />;
}
