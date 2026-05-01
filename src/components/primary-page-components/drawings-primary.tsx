// import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { GoBackIcon } from "../../assets/icons/GoBackIcon";
import { RootState } from "../../store";
import { useSelector } from "react-redux";
import { getDrawingsAreas, getSignedProcoreUrl } from "../../api/endpoints/tools";
import toast from "react-hot-toast";
import { PdfOpener } from "../pdf-opener";
import { asString, asRecord, asDateLike } from "@/lib/coerce";
import useDeviceDetection from "../../utils/hooks/deviceDetect";
import { useRouter } from "@tanstack/react-router";
import { logDocumentError } from "@/utils/rollbar";

interface DrawingArea {
  id: string;
  name: string;
}

interface DisciplineGroup {
  disciplineName: string;
  drawings: Record<string, unknown>[];
}

interface AreaGroup {
  areaName: string;
  disciplines: Record<string, DisciplineGroup>;
}

export const DrawingsPrimary = ({
  files,
}: {
  files?: Record<string, unknown>[];
  category: string;
  qrCodeIdInURL: string;
}) => {
  const router = useRouter();
  const [drawingsAreas, setDrawingsAreas] = useState<DrawingArea[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [, setIsAnimating] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;

  const linkRef = useRef<HTMLAnchorElement>(null);

  const companyData = useSelector((state: RootState) => state.company);
  const projectData = useSelector((state: RootState) => state.project);

  // Mobile detection and presigned URL state for inline PDF viewer
  const device = useDeviceDetection();
  const isMobile = device === "Mobile" || device === "Tablet";
  const [presignedUrl, setPresignedUrl] = useState<string | undefined>(
    undefined,
  );
  const [selectedDrawingPdfUrl, setSelectedDrawingPdfUrl] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [currentDrawingIndex, setCurrentDrawingIndex] = useState(-1);
  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;

  const handlePdfClose = useCallback(() => {
    setPresignedUrl(undefined);
    setSelectedDrawingPdfUrl("");
    setFileUrl("");
    setCurrentDrawingIndex(-1);
  }, []);

  // Fetch signed Procore URL when a drawing is selected on mobile
  useEffect(() => {
    if (!selectedDrawingPdfUrl || !isMobile) {
      return;
    }

    let cancelled = false;
    setIsLoadingUrl(true);

    const fetchUrl = async () => {
      try {
        const url = await getSignedProcoreUrl({
          qrCodeId: qrCodeIdInURL || "",
          fileUrl: selectedDrawingPdfUrl,
          urlOnly: true,
        });
        if (cancelled || !url || typeof url !== "string") return;
        setPresignedUrl(url);
      } catch (error) {
        logDocumentError(error, "fetch-drawing-signed-url", {
          fileUrl: selectedDrawingPdfUrl,
        });
        if (!cancelled) {
          toast.error("Failed to load drawing. Please try again.");
          setSelectedDrawingPdfUrl("");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUrl(false);
        }
      }
    };

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [selectedDrawingPdfUrl, isMobile, qrCodeIdInURL]);
  const groupedByArea = useMemo(
    () =>
      files?.reduce(
        (data, drawing) => {
          const areaId = asString(drawing.drawing_area_id, "Other");
          const areaName =
            drawingsAreas.find((area) => area.id == areaId)?.name || "Other";
          const discipline = asString(drawing.discipline, "Other");

          if (!data[areaId]) {
            data[areaId] = {
              areaName,
              disciplines: {},
            };
          }

          const areaData = data[areaId] as AreaGroup;
          if (!areaData.disciplines[discipline]) {
            areaData.disciplines[discipline] = {
              disciplineName: discipline,
              drawings: [],
            };
          }

          areaData.disciplines[discipline].drawings.push(drawing);
          return data;
        },
        {} as Record<string, AreaGroup>,
      ) || {},
    [files, drawingsAreas],
  );

  // Get the drawings in the currently selected discipline for navigation
  const currentDisciplineDrawings = useMemo(() => {
    if (!selectedArea || !selectedDiscipline) return [];
    const areaGroup = groupedByArea[selectedArea] as AreaGroup | undefined;
    if (!areaGroup) return [];
    const discipline = areaGroup.disciplines[selectedDiscipline];
    if (!discipline) return [];
    return discipline.drawings;
  }, [selectedArea, selectedDiscipline, groupedByArea]);

  const navigateToDrawing = useCallback(
    (index: number) => {
      if (index < 0 || index >= currentDisciplineDrawings.length) return;
      const drawing = currentDisciplineDrawings[index];
      const revision = asRecord(drawing.current_revision);
      const pdfUrl = asString(revision?.pdf_url, "");
      if (!pdfUrl) return;
      setCurrentDrawingIndex(index);
      setPresignedUrl(undefined);
      setSelectedDrawingPdfUrl(pdfUrl);
    },
    [currentDisciplineDrawings],
  );

  const handleNextDocument = useCallback(() => {
    navigateToDrawing(currentDrawingIndex + 1);
  }, [currentDrawingIndex, navigateToDrawing]);

  const handlePreviousDocument = useCallback(() => {
    navigateToDrawing(currentDrawingIndex - 1);
  }, [currentDrawingIndex, navigateToDrawing]);

  const handleAreaClick = (areaId: string) => {
    setIsAnimating(true);
    setSelectedArea(areaId);
    setSelectedDiscipline("");
  };

  const handleDisciplineClick = (disciplineName: string) => {
    setIsAnimating(true);
    setSelectedDiscipline(disciplineName);
  };

  const handleBackClick = () => {
    setIsAnimating(true);
    if (selectedDiscipline) {
      setSelectedDiscipline("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSelectedArea("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const fetchDrawingAreas = async () => {
      try {
        const response = await getDrawingsAreas(
          companyData._id,
          projectData._id,
        );
        setDrawingsAreas(response as DrawingArea[]);
      } catch (error) {
        toast.error("Something went wrong.");
        if (import.meta.env.DEV) {
          console.error("Error fetching drawing areas:", error);
        }
      }
    };

    fetchDrawingAreas();
  }, [companyData._id, projectData._id]);

  if (!files?.length) return null;
  return (
    <div className="relative overflow-x-hidden min-h-[80vh] col-span-2">
      <PdfOpener
        procoreUrl={fileUrl}
        formId={pdfFormId}
        useInlineViewer={isMobile}
        presignedUrl={presignedUrl}
        onViewerClose={handlePdfClose}
        onNextDocument={isMobile ? handleNextDocument : undefined}
        onPreviousDocument={isMobile ? handlePreviousDocument : undefined}
        hasNextDocument={currentDrawingIndex < currentDisciplineDrawings.length - 1}
        hasPreviousDocument={currentDrawingIndex > 0}
        documentLabel={
          currentDrawingIndex >= 0
            ? `Drawing ${currentDrawingIndex + 1} of ${currentDisciplineDrawings.length}`
            : undefined
        }
      />
      {isLoadingUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white" />
        </div>
      )}
      <a
        href=""
        className="hidden"
        ref={linkRef}
        target="_self"
        rel="noopener noreferrer"
      >
        link
      </a>
      <div
        className={`absolute top-0 left-0 w-full flex flex-col gap-2 transition-transform duration-500 ease-in-out 
          ${selectedArea ? "-translate-x-[110%]" : "translate-x-0"}`}
      >
        {(Object.entries(groupedByArea) as [string, AreaGroup][]).map(
          ([areaId, areaGroup]) => (
            <div key={areaId} className="flex flex-col gap-2 col-span-2">
              <div
                onClick={() => handleAreaClick(areaId)}
                className="group w-full max-w-md rounded-lg border border-gray-200 bg-white cursor-pointer"
              >
                <div className="flex items-center justify-between p-4 text-base font-medium text-gray-900 hover:bg-gray-50 rounded-lg shadow-md">
                  {areaGroup.areaName}
                  <ChevRightIcon />
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <div
        className={`absolute top-0 left-0 w-full flex flex-col gap-2 transition-transform duration-500 ease-in-out 
          ${selectedArea && !selectedDiscipline ? "translate-x-0" : selectedDiscipline ? "-translate-x-[110%]" : "translate-x-full"}`}
      >
        {(Object.entries(groupedByArea) as [string, AreaGroup][]).map(
          ([areaId, areaGroup]) =>
            selectedArea === areaId && (
              <div key={areaId} className="flex flex-col gap-2">
                <div
                  onClick={handleBackClick}
                  className="flex !px-3 gap-4 mb-4 items-center w-max menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
                >
                  <GoBackIcon />
                  <span className="m-0 mx-auto">{areaGroup.areaName}</span>
                  <img
                    src="../../../images/procore-icon.png"
                    alt="Procore Icon"
                    className="w-[15px]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {(
                    Object.entries(areaGroup.disciplines) as [
                      string,
                      DisciplineGroup,
                    ][]
                  ).map(([disciplineName, disciplineGroup]) => (
                    <div
                      key={disciplineName}
                      onClick={() => handleDisciplineClick(disciplineName)}
                      className="group w-full max-w-md rounded-lg border border-gray-200 bg-white cursor-pointer"
                    >
                      <div className="flex items-center justify-between p-4 text-base font-medium text-gray-900 hover:bg-gray-50 rounded-lg shadow-md">
                        {disciplineName} ({disciplineGroup.drawings.length})
                        <ChevRightIcon />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>

      <div
        className={`absolute top-0 left-0 w-full flex flex-col gap-2 transition-transform duration-500 ease-in-out ${selectedDiscipline ? "translate-x-0" : "translate-x-full"}`}
      >
        {(Object.entries(groupedByArea) as [string, AreaGroup][]).map(
          ([areaId, areaGroup2]) =>
            selectedArea === areaId && (
              <div key={areaId} className="flex flex-col gap-2">
                <div
                  onClick={handleBackClick}
                  className="flex !px-3 gap-4 mb-4 items-center w-max menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
                >
                  <GoBackIcon />
                  <span className="m-0 mx-auto">{`${selectedDiscipline}`}</span>
                  <img
                    src="../../../images/procore-icon.png"
                    alt="Procore Icon"
                    className="w-[15px]"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  {}
                  {areaGroup2.disciplines[selectedDiscipline]?.drawings.map(
                    (drawing: Record<string, unknown>, i: number) => {
                      const revision = asRecord(drawing.current_revision);
                      if (drawing && !revision) {
                        return (
                          <div
                            key={i}
                            className=" relative flex flex-col gap-3 border border-gray-300 rounded-lg bg-white col-span-1 shadow-md p-3 px-4"
                          >
                            <p>
                              Drawing id:{" "}
                              {asString(drawing.drawingId, "unknown")}{" "}
                              unavailable
                            </p>
                          </div>
                        );
                      }
                      const updatedAt = asDateLike(revision?.updated_at);
                      return (
                        <div
                          key={i}
                          className=" relative flex flex-col gap-3 border border-gray-300 rounded-lg bg-white col-span-1 shadow-md p-3 px-4"
                        >
                          <button
                            type={isMobile ? "button" : "submit"}
                            form={isMobile ? undefined : pdfFormId}
                            onClick={() => {
                              const pdfUrl = asString(revision?.pdf_url, "");
                              if (isMobile) {
                                setCurrentDrawingIndex(i);
                                setSelectedDrawingPdfUrl(pdfUrl);
                              } else {
                                setFileUrl(pdfUrl);
                              }
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <p className="  whitespace-nowrap absolute -top-3 bg-white text-sm text-gray-400">
                                {asString(drawing.number, "")}
                              </p>
                            </div>
                            <div className=" mt-1 mb-2  text-lg font-semibold">
                              <span className="">
                                {asString(drawing.title, "")}
                              </span>
                            </div>
                            <div className="flex flex-row justify-between items-end">
                              <div className=" flex flex-col">
                                <div className="flex flex-row gap-x-2 text-xs">
                                  <span className="">Drawing Date:</span>
                                  <span className=" font-bold">
                                    {updatedAt
                                      ? new Date(updatedAt).toLocaleDateString(
                                          "en-US",
                                        )
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="flex flex-row gap-x-2 text-xs">
                                  <span className="">Revision:</span>
                                  <span className="font-bold">
                                    {asString(revision?.revision_number, "")}
                                  </span>
                                </div>
                                <div className="flex flex-row gap-x-2 text-xs">
                                  <span className="">Obsolete:</span>
                                  <span className="font-bold">
                                    {drawing.obsolete === true ? "Yes" : "No"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <div className="flex flex-row gap-x-2 text-xs">
                                  <span className="">Discipline:</span>
                                  <span className="font-bold">
                                    {asString(drawing.discipline, "")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
};
