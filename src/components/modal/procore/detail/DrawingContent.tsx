import { useState, useEffect } from "react";
import type { ContentProps } from "./types";
import { asString, asRecord } from "@lib/coerce";
import { DetailField, DetailDateField, DetailSection } from "./helpers";
import { getSignedProcoreUrl } from "@/api/endpoints/tools";
import { PdfViewer } from "@components/PdfViewer";

export default function DrawingContent({ item, qrCodeId }: ContentProps) {
  const set = asString(asRecord(item.drawing_set)?.title);
  const area = asString(asRecord(item.drawing_area)?.name);
  const discipline = asString(asRecord(item.drawing_discipline)?.name);
  const revision = asRecord(item.current_revision);
  const pdfUrl = asString(revision?.pdf_url);
  const title = asString(item.title) || asString(item.number) || "Drawing";

  const [presignedUrl, setPresignedUrl] = useState<string | undefined>();
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  // Reset state when item changes
  useEffect(() => {
    setPresignedUrl(undefined);
    setShowViewer(false);
  }, [pdfUrl]);

  const handleViewDrawing = async () => {
    if (!pdfUrl || !qrCodeId) return;
    if (presignedUrl) {
      setShowViewer(true);
      return;
    }
    setLoadingPdf(true);
    try {
      const url = await getSignedProcoreUrl({
        qrCodeId,
        fileUrl: pdfUrl,
        urlOnly: true,
      });
      if (url && typeof url === "string") {
        setPresignedUrl(url);
        setShowViewer(true);
      }
    } catch {
      // Silently fail — button will remain clickable
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div>
      {pdfUrl && qrCodeId && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleViewDrawing}
            disabled={loadingPdf}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 px-4 py-6 text-gray-600 transition-colors"
          >
            {loadingPdf ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-yellow-400" />
            ) : (
              <i className="bx bx-file-find text-2xl" />
            )}
            <span className="text-sm font-medium">
              {loadingPdf ? "Loading drawing…" : "View Drawing PDF"}
            </span>
          </button>
        </div>
      )}

      {showViewer && presignedUrl && (
        <PdfViewer
          url={presignedUrl}
          onClose={() => setShowViewer(false)}
          documentLabel={title}
        />
      )}

      <div className="divide-y divide-gray-200">
        <DetailField label="Number" value={asString(item.number)} icon="bx-hash" />
        <DetailField label="Revision" value={asString(item.revision_number)} />
        <DetailField label="Discipline" value={discipline} icon="bx-ruler" />
      </div>

      <DetailSection title="Details">
        <div className="divide-y divide-gray-100">
          <DetailField label="Set" value={set} />
          <DetailField label="Area" value={area} icon="bx-map" />
          <DetailField
            label="Revision ID"
            value={asString(item.current_revision_id)}
          />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Received" value={item.received_date} />
        </div>
      </DetailSection>
    </div>
  );
}
