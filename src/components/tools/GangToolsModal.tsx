import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import { SAMPLE_STAFF, type SampleToolRecord } from "@/data/seed/toolTrackerSeed";

export type GangOwnerStrategy = "keep" | "reassign";

export interface GangCreatePayload {
  name: string;
  foreman?: string;
  ownerStrategy: GangOwnerStrategy;
  /** Required when ownerStrategy === "reassign". */
  reassignTo?: string;
}

interface GangToolsModalProps {
  open: boolean;
  /** The tool records being ganged. */
  tools: SampleToolRecord[];
  onClose: () => void;
  onConfirm: (payload: GangCreatePayload) => void;
}

export default function GangToolsModal(props: GangToolsModalProps) {
  const { open, tools, onClose, onConfirm } = props;

  const [name, setName] = useState("");
  const [foreman, setForeman] = useState<string | undefined>(undefined);
  const [ownerStrategy, setOwnerStrategy] =
    useState<GangOwnerStrategy>("keep");
  const [reassignTo, setReassignTo] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  // Tally owners across the selection so we can both show the conflict and
  // pick a reasonable default reassignee (the most-common existing owner).
  const ownerTally = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tools) {
      counts[t.assignedTo] = (counts[t.assignedTo] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tools]);

  const hasMixedOwners = ownerTally.length > 1;

  useEffect(() => {
    if (!open) return;
    setName("");
    setForeman(ownerTally[0]?.[0] ?? undefined);
    setOwnerStrategy("keep");
    setReassignTo(ownerTally[0]?.[0] ?? undefined);
    setTouched(false);
  }, [open, ownerTally]);

  const trimmedName = name.trim();
  const nameInvalid = touched && trimmedName.length === 0;
  const reassignInvalid =
    touched && ownerStrategy === "reassign" && !reassignTo;
  const canConfirm =
    trimmedName.length > 0 &&
    (ownerStrategy === "keep" || (ownerStrategy === "reassign" && !!reassignTo));

  const handleConfirm = () => {
    setTouched(true);
    if (!canConfirm) return;
    onConfirm({
      name: trimmedName,
      foreman,
      ownerStrategy,
      reassignTo:
        ownerStrategy === "reassign" ? reassignTo : undefined,
    });
  };

  const staffOptions = SAMPLE_STAFF.map((s) => ({ value: s, label: s }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gang tools"
      subtitle={`Bundle ${tools.length} tools into a named gang for batch check-out, check-in, and project moves.`}
      size="lg"
      allowOverflow
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="gang-tools-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={touched && !canConfirm}
            leftIconClass="bx bx-collection"
            data-testid="gang-tools-confirm"
          >
            Create gang
          </Button>
        </div>
      }
    >
      <div className="space-y-5" data-testid="gang-tools-modal">
        <div>
          <label
            htmlFor="gang-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Gang name <span className="text-red-500">*</span>
          </label>
          <input
            id="gang-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Concrete Pour Set", "Demo Crew Kit"'
            className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
              nameInvalid ? "border-red-400" : "border-gray-300"
            }`}
            data-testid="gang-tools-name"
          />
          {nameInvalid && (
            <p className="mt-1 text-xs text-red-600">
              Give the gang a name so it's easy to find later.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Foreman{" "}
            <span className="text-xs font-normal text-gray-400">
              (optional)
            </span>
          </label>
          <SearchComboBox
            options={staffOptions}
            value={foreman}
            onChange={(next) =>
              setForeman(typeof next === "string" ? next : undefined)
            }
            placeholder="Pick a staff member…"
            allowCustomValue={false}
            usePortal
          />
          <p className="mt-1 text-xs text-gray-500">
            The person responsible for the gang overall. Doesn't have to
            match individual tool owners.
          </p>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Tools in this gang ({tools.length})
          </div>
          <ul
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 max-h-48 overflow-y-auto text-sm text-gray-700 divide-y divide-gray-100"
            data-testid="gang-tools-list"
          >
            {tools.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0"
              >
                <i className="bx bx-wrench text-gray-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.name}</div>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {t.assignedTo}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {hasMixedOwners && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
            data-testid="gang-tools-conflict"
          >
            <div className="flex items-start gap-2">
              <i
                className="bx bx-error-circle text-amber-600 text-lg mt-0.5"
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-amber-900">
                  Mixed owners detected
                </div>
                <div className="mt-0.5 text-xs text-amber-800">
                  {ownerTally
                    .map(([owner, count]) => `${owner} (${count})`)
                    .join(" · ")}
                </div>
              </div>
            </div>

            <fieldset className="mt-3 space-y-2">
              <legend className="text-xs font-medium text-amber-900 mb-1">
                How should ownership be handled?
              </legend>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-amber-100/60">
                <input
                  type="radio"
                  name="gang-owner-strategy"
                  value="keep"
                  checked={ownerStrategy === "keep"}
                  onChange={() => setOwnerStrategy("keep")}
                  className="mt-0.5"
                  data-testid="gang-tools-strategy-keep"
                />
                <span className="text-sm">
                  <span className="font-medium text-amber-900">
                    Keep each tool's current owner
                  </span>{" "}
                  <span className="text-xs text-amber-700">(recommended)</span>
                  <span className="block text-xs text-amber-800 mt-0.5">
                    The gang bundles tools but each stays with its current
                    owner. Cleanest for shared kits where everyone keeps
                    their own assignments.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-amber-100/60">
                <input
                  type="radio"
                  name="gang-owner-strategy"
                  value="reassign"
                  checked={ownerStrategy === "reassign"}
                  onChange={() => setOwnerStrategy("reassign")}
                  className="mt-0.5"
                  data-testid="gang-tools-strategy-reassign"
                />
                <span className="text-sm flex-1 min-w-0">
                  <span className="font-medium text-amber-900">
                    Reassign all tools to one owner
                  </span>
                  <span className="block text-xs text-amber-800 mt-0.5">
                    All tools in the gang move to the chosen staff member.
                  </span>
                  {ownerStrategy === "reassign" && (
                    <div className="mt-2">
                      <SearchComboBox
                        options={staffOptions}
                        value={reassignTo}
                        onChange={(next) =>
                          setReassignTo(
                            typeof next === "string" ? next : undefined,
                          )
                        }
                        placeholder="Pick a staff member…"
                        allowCustomValue={false}
                        usePortal
                      />
                      {reassignInvalid && (
                        <p className="mt-1 text-xs text-red-600">
                          Pick the staff member to reassign tools to.
                        </p>
                      )}
                    </div>
                  )}
                </span>
              </label>
            </fieldset>
          </div>
        )}
      </div>
    </Modal>
  );
}
