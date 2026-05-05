import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import {
  SAMPLE_STAFF,
  type SampleGang,
  type SampleToolRecord,
} from "@/data/seed/toolTrackerSeed";

export type AddToGangAssignment = "keep" | "reassign";

export interface AddToGangPayload {
  gangId: string;
  /** When undefined, the tool keeps its current owner. */
  reassignTo?: string;
}

interface AddToGangModalProps {
  open: boolean;
  /** Tool being added. Null when modal is closed. */
  tool: SampleToolRecord | null;
  /** All existing gangs to choose from. */
  gangs: SampleGang[];
  /** All tool records, used to compute member counts and owner overlap
   * for the gang options. */
  allTools: SampleToolRecord[];
  onClose: () => void;
  onConfirm: (payload: AddToGangPayload) => void;
}

export default function AddToGangModal(props: AddToGangModalProps) {
  const { open, tool, gangs, allTools, onClose, onConfirm } = props;
  const [gangId, setGangId] = useState<string | undefined>(undefined);
  const [assignment, setAssignment] = useState<AddToGangAssignment>("keep");
  const [reassignTo, setReassignTo] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setGangId(undefined);
      setAssignment("keep");
      setReassignTo(undefined);
      setTouched(false);
    }
  }, [open]);

  const selectedGang = gangs.find((g) => g.id === gangId);

  // When the user picks a gang with a foreman, default the reassign
  // dropdown to that foreman as a sensible starting point.
  useEffect(() => {
    if (selectedGang?.foreman) {
      setReassignTo(selectedGang.foreman);
    }
  }, [selectedGang?.foreman]);

  // Pre-compute member counts + a hint about ownership overlap so the
  // user can pick the right gang at a glance.
  const gangOptions = useMemo(() => {
    return gangs.map((g) => {
      const members = allTools.filter((t) => t.gangId === g.id);
      const hasOwnerMatch =
        !!tool && members.some((m) => m.assignedTo === tool.assignedTo);
      const memberCount = members.length;
      const subtitle = [
        g.foreman ? `Foreman: ${g.foreman}` : null,
        `${memberCount} ${memberCount === 1 ? "tool" : "tools"}`,
        hasOwnerMatch ? `includes ${tool?.assignedTo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        value: g.id,
        label: g.name,
        sublabel: subtitle,
      };
    });
  }, [gangs, allTools, tool]);

  // SearchComboBox doesn't render a sublabel natively. Flatten label so
  // both lines appear in the option list, while keeping the selected
  // value rendering clean.
  const flatOptions = gangOptions.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  const reassignInvalid =
    touched && assignment === "reassign" && !reassignTo;
  const canConfirm =
    !!gangId &&
    (assignment === "keep" || (assignment === "reassign" && !!reassignTo));

  const handleConfirm = () => {
    setTouched(true);
    if (!canConfirm || !gangId) return;
    onConfirm({
      gangId,
      reassignTo: assignment === "reassign" ? reassignTo : undefined,
    });
  };

  const staffOptions = SAMPLE_STAFF.map((s) => ({ value: s, label: s }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to gang"
      subtitle={
        tool
          ? `Add "${tool.name}" to an existing gang and choose how the assignment should be handled.`
          : "Add this tool to an existing gang."
      }
      size="md"
      allowOverflow
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="add-to-gang-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={touched && !canConfirm}
            leftIconClass="bx bx-collection"
            data-testid="add-to-gang-confirm"
          >
            {selectedGang
              ? `Add to "${selectedGang.name}"`
              : "Add to gang"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3" data-testid="add-to-gang-modal">
        {gangs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <i
              className="bx bx-collection text-3xl text-gray-400"
              aria-hidden
            />
            <div className="mt-2 text-sm font-medium text-gray-700">
              No gangs yet
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Select two or more standalone tools and click "Gang tools…"
              in the bulk action bar to create your first gang.
            </div>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700">
              Pick a gang
            </label>
            <SearchComboBox
              options={flatOptions}
              value={gangId}
              onChange={(next) =>
                setGangId(typeof next === "string" ? next : undefined)
              }
              placeholder="Search gangs…"
              allowCustomValue={false}
              usePortal
            />
            {/* List the gangs with subtitles below for context — the
                combobox itself only shows labels. */}
            <ul
              className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-100"
              data-testid="add-to-gang-list"
            >
              {gangOptions.map((opt) => {
                const isSelected = opt.value === gangId;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => setGangId(opt.value)}
                      className={`w-full flex items-start gap-3 px-3 py-2 text-left text-sm hover:bg-white transition ${
                        isSelected ? "bg-white ring-1 ring-brand-300" : ""
                      }`}
                    >
                      <i
                        className={`bx bx-collection mt-0.5 ${
                          isSelected ? "text-brand-600" : "text-gray-400"
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {opt.label}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {opt.sublabel}
                        </div>
                      </div>
                      {isSelected && (
                        <i
                          className="bx bx-check text-brand-600 text-lg"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedGang && tool && (
              <fieldset
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 mt-2 space-y-2"
                data-testid="add-to-gang-assignment"
              >
                <legend className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-1">
                  Ownership
                </legend>

                <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="add-to-gang-assignment"
                    value="keep"
                    checked={assignment === "keep"}
                    onChange={() => setAssignment("keep")}
                    className="mt-0.5"
                    data-testid="add-to-gang-keep"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-gray-900">
                      Keep current owner
                    </span>{" "}
                    <span className="text-xs text-gray-500">
                      (recommended)
                    </span>
                    <span className="block text-xs text-gray-600 mt-0.5">
                      Stays assigned to{" "}
                      <span className="font-medium text-gray-700">
                        {tool.assignedTo}
                      </span>
                      . The gang membership is independent of ownership.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="add-to-gang-assignment"
                    value="reassign"
                    checked={assignment === "reassign"}
                    onChange={() => setAssignment("reassign")}
                    className="mt-0.5"
                    data-testid="add-to-gang-reassign"
                  />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium text-gray-900">
                      Reassign to a different staff member
                    </span>
                    <span className="block text-xs text-gray-600 mt-0.5">
                      The tool will be reassigned away from{" "}
                      {tool.assignedTo}.
                      {selectedGang.foreman
                        ? ` Defaults to the gang's foreman, ${selectedGang.foreman}.`
                        : ""}
                    </span>
                    {assignment === "reassign" && (
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
                            Pick the staff member to reassign this tool to.
                          </p>
                        )}
                      </div>
                    )}
                  </span>
                </label>
              </fieldset>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
