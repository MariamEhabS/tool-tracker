import { useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { createToolTrackers } from "@/api/stubs/toolTrackerStub";
import { readCreateQRState } from "@/lib/urlState";
import type {
  CreateToolTrackersResponse,
  ToolInput,
  ToolTrackerRules as RulesShape,
} from "@/components/create-qr/toolTracker/types";
import ToolTrackerScanPreview from "./ToolTrackerScanPreview";
import ToolTrackerRulesEditor, {
  DEFAULT_RULES,
} from "./ToolTrackerRulesEditor";

/**
 * Tool Tracker — Check-out rules screen (PRD §4 Stage 4).
 *
 * Shared between the Single and Bulk Configure flows. Rendered when
 * `phase=rules` is in the URL. The dispatch parent (ConfigureToolTrackerSingle
 * or ConfigureToolTrackerBulk) supplies the assembled `tools` list — one
 * entry for the Single flow, N entries for the Bulk flow.
 *
 * On Generate, fires the `createToolTrackers` stub from PRD §10.1 with
 * `{ tools, rules }`. Loading state on the Generate button during the
 * stubbed delay. On success, calls `onGenerated(response)` so the dispatch
 * parent can store the response and advance `phase=generated`. On failure,
 * shows an error toast and stays on the Rules screen.
 *
 * The four rule cards live in `ToolTrackerRulesEditor`, a controlled
 * sub-component reused by the Stage 6 detail-page Settings panel.
 */

interface ToolTrackerRulesProps {
  tools: ToolInput[];
  onBackToInfo: () => void;
  onGenerated: (response: CreateToolTrackersResponse) => void;
}

export default function ToolTrackerRules({
  tools,
  onBackToInfo,
  onGenerated,
}: ToolTrackerRulesProps) {
  const { location } = useRouterState();
  const [rules, setRules] = useState<RulesShape>(DEFAULT_RULES);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const toolCount = tools.length;
  const headerCountWord = toolCount === 1 ? "QR code" : "QR codes";
  const generateLabel = useMemo(() => {
    if (toolCount === 1) return "Generate QR Code";
    return `Generate ${toolCount} QR Codes`;
  }, [toolCount]);

  const previewTool = tools[0] ?? {
    name: "Example Tool",
    serial: "",
    homeLocation: "",
  };

  const validateBeforeGenerate = (): string | null => {
    if (toolCount === 0) return "Add at least one tool before generating.";
    if (rules.pinEnabled && rules.pinMode === "custom") {
      const pin = (rules.customPin ?? "").trim();
      if (!/^\d{4}$/.test(pin)) {
        return "Enter a 4-digit Custom PIN before generating.";
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    const validationError = validateBeforeGenerate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsGenerating(true);
    try {
      const { projectId, groupingId } = readCreateQRState(location.search);
      const response = await createToolTrackers({
        tools,
        rules,
        ...(projectId ? { projectId } : {}),
        ...(groupingId ? { groupId: groupingId } : {}),
      });
      onGenerated(response);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not generate QR codes. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="tool-tracker-rules">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          Check-out rules
        </h3>
        <p className="mt-1 text-xs text-gray-600" data-testid="rules-header-sub">
          These rules apply to all {toolCount} {headerCountWord} you&apos;re
          about to create. You can change them anytime from the tool&apos;s
          settings.
        </p>
      </div>

      <ToolTrackerRulesEditor
        rules={rules}
        onChange={setRules}
        disabled={isGenerating}
      />

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onBackToInfo}
            disabled={isGenerating}
            data-testid="rules-back"
          >
            Back
          </Button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={isGenerating}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition"
            data-testid="rules-preview-link"
          >
            <i className="bx bx-show text-base" aria-hidden /> Preview the scan
            experience
          </button>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating || toolCount === 0}
          data-testid="rules-generate"
        >
          {isGenerating ? "Generating…" : generateLabel}
        </Button>
      </div>

      {previewOpen && (
        <ToolTrackerScanPreview
          tool={previewTool}
          rules={rules}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
