// import React from 'react';
import { useDispatch, useSelector } from "react-redux";
import { ChevLeftIcon } from "@/assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { useEffect, useRef, useState, useCallback } from "react";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import { OpenOutsideIcon } from "../../assets/icons/OpenOutsideIcon";
import { RootState } from "@/store";
import { CloseIcon } from "../../assets/icons/CloseIcon";
import {
  getSignedProcoreUrl,
  uploadUpdatedProcoreForm,
} from "../../api/endpoints/tools";
import toast from "react-hot-toast";

import { UserInfoModal } from "@/components/modal/procore/UserInfoModal";
import {
  getCreatorInfoFromStorage,
  saveCreatorInfoToStorage,
} from "@/utils/creatorInfo";

interface FormsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
  openEditDefault?: boolean;
}

export const FormsPageComponent = ({
  procoreData,
  qrCodeId,
  projectData,
  itemId,
  openEditDefault = false,
}: FormsPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [isPdfLoaded, setIsPdfLoaded] = useState<boolean>(false);
  const [originalPdfBuffer, setOriginalPdfBuffer] =
    useState<ArrayBuffer | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pageMetaRef = useRef<
    Array<{ canvasWidth: number; canvasHeight: number }>
  >([]);
  const [edits, setEdits] = useState<
    Array<{
      pageIndex: number;
      x: number;
      y: number;
      text: string;
      fontPx?: number;
    }>
  >([]);
  const [activeTool, setActiveTool] = useState<"text" | "select">("text");
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorCompany, setCreatorCompany] = useState("");
  const [deferredEditRawUrl, setDeferredEditRawUrl] = useState<string | null>(
    null,
  );

  const loadScript = useCallback(
    (src: string) =>
      new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      }),
    [],
  );

  const ensurePdfEngines = useCallback(async () => {
    const w = window as unknown as {
      pdfjsLib?: { GlobalWorkerOptions: { workerSrc: string } };
      PDFLib?: unknown;
    };
    if (!w.pdfjsLib) {
      await loadScript(
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
      );
      (
        window as unknown as {
          pdfjsLib?: { GlobalWorkerOptions: { workerSrc: string } };
        }
      ).pdfjsLib!.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
    if (!w.PDFLib) {
      await loadScript("https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js");
    }
  }, [loadScript]);

  const renderPdfInline = useCallback(
    async (srcBuffer: ArrayBuffer | Uint8Array) => {
      type PdfGetDocument = (args: { data: Uint8Array }) => {
        promise: Promise<{
          numPages: number;
          getPage: (n: number) => Promise<{
            getViewport: (o: { scale: number }) => {
              width: number;
              height: number;
            };
            render: (o: {
              canvasContext: CanvasRenderingContext2D;
              viewport: unknown;
              transform: number[] | null;
            }) => { promise: Promise<void> };
          }>;
        }>;
      };
      const w = window as unknown as {
        pdfjsLib: { getDocument: PdfGetDocument };
      };
      const pdfjsLib = w.pdfjsLib;
      const container = viewerRef.current;
      if (!container) return;
      // Security: Using removeChild instead of innerHTML for safer DOM clearing
      // This is required before re-rendering PDF pages with pdf.js
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      pageMetaRef.current = [];
      let uint8: Uint8Array;
      if (srcBuffer instanceof Uint8Array) {
        uint8 = srcBuffer;
      } else {
        // Create a fresh copy from ArrayBuffer to avoid detached/empty views
        const view = new Uint8Array(srcBuffer);
        uint8 = new Uint8Array(view.length);
        uint8.set(view);
      }
      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      const pdf = await loadingTask.promise;
      setIsPdfLoaded(true);
      // Measure available rendering area inside the modal body
      const containerRect = container.getBoundingClientRect();
      const availableWidth = Math.max(320, containerRect.width - 16);
      const availableHeight = Math.max(240, containerRect.height - 16);
      const devicePixelRatio = Math.min(2, window.devicePixelRatio || 1);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const scaleToWidth = availableWidth / baseViewport.width;
        const scaleToHeight = availableHeight / baseViewport.height;
        const scale = Math.min(scaleToWidth, scaleToHeight);
        const viewport = page.getViewport({ scale: scale || 1 });

        const wrapper = document.createElement("div");
        wrapper.style.position = "relative";
        wrapper.style.margin = "12px auto";
        wrapper.style.background = "white";
        wrapper.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
        wrapper.style.border = "1px solid #e5e7eb";
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        // Render at higher backing resolution for crisp text, but keep CSS size stable
        canvas.width = Math.max(
          1,
          Math.floor(viewport.width * devicePixelRatio),
        );
        canvas.height = Math.max(
          1,
          Math.floor(viewport.height * devicePixelRatio),
        );
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";
        wrapper.appendChild(canvas);

        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.bottom = "0";
        overlay.style.pointerEvents = "auto";
        // Attach press-and-hold drag behavior to markers
        const attachDrag = (el: HTMLDivElement) => {
          let pointerDown = false;
          let dragStarted = false;
          let pressTimer: number | undefined;
          let offsetX = 0;
          let offsetY = 0;

          const clearPress = () => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = undefined;
            }
          };

          const onPointerDown = (ev: MouseEvent | TouchEvent) => {
            pointerDown = true;
            const point = "touches" in ev ? ev.touches[0] : (ev as MouseEvent);
            const elRect = el.getBoundingClientRect();
            offsetX = point.clientX - elRect.left;
            offsetY = point.clientY - elRect.top;
            pressTimer = window.setTimeout(() => {
              dragStarted = true;
              el.style.cursor = "grabbing";
            }, 150);
            ev.preventDefault();
          };

          const onPointerMove = (ev: MouseEvent | TouchEvent) => {
            if (!pointerDown || !dragStarted) return;
            const point = "touches" in ev ? ev.touches[0] : (ev as MouseEvent);
            const overlayRect = overlay.getBoundingClientRect();
            let newLeft = point.clientX - overlayRect.left - offsetX;
            let newTop = point.clientY - overlayRect.top - offsetY;
            newLeft = Math.max(
              0,
              Math.min(newLeft, overlayRect.width - el.offsetWidth),
            );
            newTop = Math.max(
              0,
              Math.min(newTop, overlayRect.height - el.offsetHeight),
            );
            el.style.left = `${newLeft}px`;
            el.style.top = `${newTop}px`;
            const editIndexAttr = (
              el as unknown as { dataset?: { editIndex?: string } }
            ).dataset?.editIndex;
            if (editIndexAttr !== undefined) {
              const idx = Number(editIndexAttr);
              setEdits((prev) => {
                if (!prev[idx]) return prev;
                const copy = prev.slice();
                copy[idx] = { ...copy[idx], x: newLeft, y: newTop };
                return copy;
              });
            }
            ev.preventDefault();
          };

          const onPointerUpCancel = () => {
            pointerDown = false;
            dragStarted = false;
            el.style.cursor = "grab";
            clearPress();
          };

          el.style.cursor = "grab";
          el.addEventListener("mousedown", onPointerDown);
          el.addEventListener("touchstart", onPointerDown, { passive: false });
          window.addEventListener("mousemove", onPointerMove, {
            passive: false,
          });
          window.addEventListener("touchmove", onPointerMove, {
            passive: false,
          });
          window.addEventListener("mouseup", onPointerUpCancel);
          window.addEventListener("touchend", onPointerUpCancel);
        };

        overlay.addEventListener("click", (e) => {
          if (activeTool !== "text") return;
          const rect = overlay.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const text = prompt("Enter text");
          if (!text) return;
          const marker = document.createElement("div");
          marker.textContent = text;
          marker.style.position = "absolute";
          marker.style.left = `${x}px`;
          marker.style.top = `${y}px`;
          marker.style.transform = "translateY(-100%)";
          marker.style.padding = "0 0";
          marker.style.background = "rgba(255,255,0,0.6)";
          marker.style.fontSize = "12px";
          marker.style.lineHeight = "1";
          setEdits((prev) => {
            const fontPx = parseFloat(
              window.getComputedStyle(marker).fontSize || "12",
            );
            const next = [
              ...prev,
              { pageIndex: pageNum - 1, x, y, text, fontPx },
            ];
            (
              marker as unknown as { dataset: { editIndex?: string } }
            ).dataset.editIndex = String(next.length - 1);
            return next;
          });
          // Mark PDF as edited to enable Save button
          try {
            const w = window as unknown as {
              PDFLib?: { PDFDocument?: unknown };
            };
            const { PDFDocument } = w.PDFLib || {};
            if (!PDFDocument) {
              setEditedBlob(
                new Blob([new Uint8Array([1])], {
                  type: "application/octet-stream",
                }),
              );
            }
          } catch {
            // ignore
          }
          overlay.appendChild(marker);
          attachDrag(marker);
        });
        wrapper.appendChild(overlay);

        container.appendChild(wrapper);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Reset transform; pdf.js will scale via transform matrix we pass
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        const transform =
          devicePixelRatio !== 1
            ? [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
            : null;
        await page.render({
          canvasContext: ctx as CanvasRenderingContext2D,
          viewport,
          transform: transform as number[],
        }).promise;
        pageMetaRef.current.push({
          canvasWidth: viewport.width,
          canvasHeight: viewport.height,
        });
        // Hint browsers for sharper presentation at smaller scales
        (
          canvas.style as unknown as { imageRendering?: string }
        ).imageRendering = "crisp-edges";
      }
    },
    [activeTool],
  );
  const companyData = useSelector((state: RootState) => state.company);
  const canEditInTaliho = Boolean(companyData?.editProcoreItemsAllowed);

  const openEditForForm = useCallback(
    async (rawUrl: string | null) => {
      setIsEditModalOpen(true);
      if (!rawUrl) return;
      try {
        setIsSigning(true);
        const buffer = await getSignedProcoreUrl({
          qrCodeId,
          fileUrl: rawUrl,
          urlOnly: false,
          sendBuffer: true,
        });
        await ensurePdfEngines();
        // Allow modal DOM to mount before rendering into viewer
        if (!viewerRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (buffer) {
          await renderPdfInline(buffer as ArrayBuffer | Uint8Array);
          setIsPdfLoaded(true);
          try {
            const buf = buffer as ArrayBuffer;
            // Store a copy of the original PDF bytes for save-time edits
            const view = new Uint8Array(buf);
            const copy = new Uint8Array(view.length);
            copy.set(view);
            setOriginalPdfBuffer(copy.buffer);
          } catch (err) {
            if (import.meta.env.DEV) {
              console.error("Error storing original PDF bytes", err);
            }
          }
        }
      } catch {
        setIsPdfLoaded(false);
      } finally {
        setIsSigning(false);
      }
    },
    [qrCodeId, ensurePdfEngines, renderPdfInline],
  );

  const handleOpenEditGated = useCallback(
    (rawUrl: string | null) => {
      const stored = getCreatorInfoFromStorage();
      const hasInfo = Boolean(
        stored &&
          typeof stored.name === "string" &&
          stored.name.trim() &&
          typeof stored.company === "string" &&
          stored.company.trim(),
      );
      if (hasInfo) {
        openEditForForm(rawUrl);
        return;
      }
      setCreatorName(stored?.name || "");
      setCreatorCompany(stored?.company || "");
      setDeferredEditRawUrl(rawUrl || null);
      setShowUserInfoModal(true);
    },
    [openEditForForm],
  );

  useEffect(() => {
    if (hasAutoOpened) return;
    if (!openEditDefault) return;
    if (!canEditInTaliho) return;
    try {
      const arr = Array.isArray(procoreData)
        ? (procoreData as ProcoreToolData)
        : [];
      const target = arr.find((d) => String(d?.id) === String(itemId));
      const rawUrl =
        (target as unknown as { fillable_pdf?: { url?: string } })?.fillable_pdf
          ?.url || null;
      const stored = getCreatorInfoFromStorage();
      const hasInfo = Boolean(
        stored &&
          typeof stored.name === "string" &&
          stored.name.trim() &&
          typeof stored.company === "string" &&
          stored.company.trim(),
      );
      if (!hasInfo) {
        setCreatorName(stored?.name || "");
        setCreatorCompany(stored?.company || "");
        setDeferredEditRawUrl(rawUrl || null);
        setShowUserInfoModal(true);
        setHasAutoOpened(true);
        return;
      }
      if (rawUrl) {
        setHasAutoOpened(true);
        openEditForForm(rawUrl);
      }
    } catch {
      // ignore auto-open errors
    }
  }, [
    openEditDefault,
    canEditInTaliho,
    procoreData,
    itemId,
    hasAutoOpened,
    openEditForForm,
  ]);
  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="bg-white rounded-lg p-2">
        <div className="flex justify-between mt-2">
          <button
            onClick={() => window.history.go(-1)}
            className=" flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
          >
            <div className="flex items-center">
              <ChevLeftIcon />
              <span className="text-xs">Forms</span>
            </div>
            <img
              src="../../../images/procore-icon.png"
              alt="Procore Icon"
              className="w-[15px]"
            />
          </button>
          <button
            onClick={clearAndGoBack}
            className={`flex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${procoreData.map((data) => (data.procoreConnect === true ? "hidden" : ""))}`}
          >
            <TilesIcon />
            <div className="flex items-center">
              <span className="text-xs">Menu</span>
              <ChevRightIcon />
            </div>
          </button>
        </div>
      </div>
      {procoreData.map((data, index) => (
        <div key={index} className="bg-white rounded-lg">
          <div className="grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 rounded-lg shadow-md bg-gray-100 pb-4">
            <div className="py-2 pt-4 col-span-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start gap-3 col-span-2">
                  <p className="text-xs text-left leading-0 text-yellow-900 font-[300]">
                    Form Name
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900 -mt-1">
                    {data.name}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start justify-self-start col-span-2">
              <span className="text-xs text-yellow-900 font-[300]">
                Template
              </span>
              <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                {data?.form_template_name}
              </span>
            </div>

            <div className="flex flex-col items-start justify-self-start col-span-2">
              <span className="text-xs text-yellow-900 font-[300]">
                Created By
              </span>
              <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                {data?.created_by?.name}
              </span>
            </div>

            <div className="col-span-3 overflow-hidden">
              <h3 className="text-yellow-900 font-[300] mb-[5px] text-xs">
                Description
              </h3>
              <div className="bg-white rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-scroll">
                {!data.description ? (
                  <p className="italic">No description provided.</p>
                ) : (
                  data.description
                )}
              </div>
            </div>

            <div className="flex !w-full justify-center gap-2 col-span-3 pt-3">
              {canEditInTaliho ? (
                <button
                  onClick={() => {
                    const rawUrl =
                      (data as unknown as { fillable_pdf?: { url?: string } })
                        ?.fillable_pdf?.url || null;
                    handleOpenEditGated(rawUrl);
                  }}
                  className="flex justify-center w-max bg-yellow-100 px-3 py-2 rounded-md font-semibold text-gray-700 border border-yellow-400"
                >
                  Edit in Taliho
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4 pt-0 space-y-4">
            <div className="-mx-4" />
            <div className="w-full overflow-hidden">
              <div className="flex justify-evenly space-x-1 border-b mt-2 border-gray-300">
                {["documents", "dates", "people", "links", "more"].map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === tab ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-4">
                {activeTab === "documents" && (
                  <div className="space-y-2">
                    {data?.attachments ? (
                      <div
                        key={index}
                        className="flex flex-col gap-2 px-2 pb-4"
                      >
                        <VerticalAttachmentSection
                          attachments={[
                            ...(data.attachments || []),
                            ...(data.attachment ? [data.attachment] : []),
                          ].flat()}
                          qrCodeId={qrCodeId}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No documents available for this form.
                      </p>
                    )}
                  </div>
                )}
                {activeTab === "dates" && (
                  <div className="space-y-2">
                    <div className="flex flex-col justify-start items-start mt-1">
                      <span className="text-sm text-gray-500 col-span-1">
                        Date Created
                      </span>
                      <p className="font-medium text-gray-900 col-span-1">
                        {formatProcoreTime(data.created_at || "")}
                      </p>
                    </div>
                  </div>
                )}
                {activeTab === "people" && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500">
                      No people available for this form.
                    </div>
                  </div>
                )}
                {activeTab === "links" && (
                  <div className="flex justify-center mt-4">
                    <a
                      href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData.procoreProjectID}/project/forms/${itemId}`}
                      className="flex items-center gap-4 bg-yellow-400 px-2 py-2 rounded-md text-gray-700 w-max"
                    >
                      <span>Go To Procore App</span>
                      <OpenOutsideIcon />
                    </a>
                  </div>
                )}

                {activeTab === "more" && (
                  <div className="space-y-4">
                    <div className="flex flex-col justify-start items-start mt-1">
                      <span className="text-sm text-gray-500">Form ID</span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {canEditInTaliho && isEditModalOpen && (
              <div className="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center overflow-hidden">
                <div className="flex flex-col w-[95%] max-w-5xl min-h-[85vh] m-0 mx-auto bg-white rounded-lg shadow-lg shadow-gray-500 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Edit Form (PDF)</h2>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={!isPdfLoaded && !editedBlob}
                        onClick={async () => {
                          const rawUrl =
                            (
                              data as unknown as {
                                fillable_pdf?: { url?: string };
                              }
                            )?.fillable_pdf?.url || null;
                          if (!editedBlob && !rawUrl) {
                            toast.error("Original form URL unavailable.");
                            return;
                          }
                          let blobToUpload: Blob = editedBlob as Blob;
                          if (!blobToUpload) {
                            try {
                              const w = window as unknown as {
                                PDFLib?: { PDFDocument?: unknown };
                              };
                              await ensurePdfEngines();
                              // Use the original loaded buffer if available; otherwise fetch a fresh buffer
                              let srcBytes: ArrayBuffer | null =
                                originalPdfBuffer;
                              if (!srcBytes) {
                                const freshBuffer = await getSignedProcoreUrl({
                                  qrCodeId,
                                  fileUrl: rawUrl as string,
                                  urlOnly: false,
                                  sendBuffer: true,
                                });
                                srcBytes = (freshBuffer ||
                                  null) as ArrayBuffer | null;
                              }
                              if (!srcBytes) {
                                toast.error(
                                  "Unable to load original PDF bytes. Please try again.",
                                );
                                return;
                              }
                              // Validate PDF magic header
                              const head = new Uint8Array(srcBytes.slice(0, 5));
                              const magic = String.fromCharCode(...head);
                              if (magic !== "%PDF-") {
                                toast.error(
                                  "Invalid PDF source. Please refresh and try again.",
                                );
                                return;
                              }
                              const { PDFDocument, StandardFonts, rgb } =
                                (w.PDFLib || {}) as {
                                  PDFDocument: {
                                    load: (
                                      b: ArrayBuffer,
                                      opts?: unknown,
                                    ) => Promise<{
                                      embedFont: (
                                        f: unknown,
                                      ) => Promise<unknown>;
                                      getPages: () => unknown[];
                                      save: () => Promise<Uint8Array>;
                                    }>;
                                  };
                                  StandardFonts: { Helvetica: unknown };
                                  rgb: (
                                    r: number,
                                    g: number,
                                    b: number,
                                  ) => unknown;
                                };
                              const pdfDoc = await PDFDocument.load(srcBytes, {
                                ignoreEncryption: true,
                              });
                              const font = await pdfDoc.embedFont(
                                StandardFonts.Helvetica,
                              );
                              const pages = pdfDoc.getPages() as Array<{
                                getWidth: () => number;
                                getHeight: () => number;
                                drawText: (
                                  text: string,
                                  opts: {
                                    x: number;
                                    y: number;
                                    size: number;
                                    font: unknown;
                                    color: unknown;
                                  },
                                ) => void;
                              }>;
                              edits.forEach((e) => {
                                const page = pages[e.pageIndex];
                                const meta = pageMetaRef.current[e.pageIndex];
                                if (!page || !meta) return;
                                // Map canvas CSS pixels to PDF points using per-page ratios
                                const pdfW = page.getWidth();
                                const pdfH = page.getHeight();
                                const scaleX = pdfW / meta.canvasWidth;
                                const scaleY = pdfH / meta.canvasHeight;
                                const xPdf = e.x * scaleX;
                                // Baseline-correct Y: subtract scaled font height so top-left aligns
                                const fontPx = e.fontPx ?? 12;
                                const fontPt = fontPx * scaleY; // approx mapping CSS px -> PDF pts via scaleY
                                const yPdf =
                                  pdfH - e.y * scaleY - fontPt * 0.8 + 16;
                                page.drawText(e.text, {
                                  x: xPdf,
                                  y: yPdf,
                                  size: fontPt,
                                  font,
                                  color: rgb(0, 0, 0),
                                });
                              });
                              const bytes = await pdfDoc.save();
                              const arrayBuffer = bytes.buffer.slice(
                                bytes.byteOffset,
                                bytes.byteOffset + bytes.byteLength,
                              ) as ArrayBuffer;
                              blobToUpload = new Blob([arrayBuffer], {
                                type: "application/pdf",
                              });
                            } catch (_err) {
                              toast.error("Failed to prepare PDF for upload.");
                              return;
                            }
                          }
                          const firstName =
                            Array.isArray(procoreData) && procoreData.length > 0
                              ? String(
                                  (procoreData[0] as { name?: string })?.name ||
                                    "",
                                )
                              : "";
                          const safeName =
                            (firstName.split(".pdf")[0] || "form") + ".pdf";
                          const file = new File([blobToUpload], safeName, {
                            type: "application/pdf",
                          });
                          const toastId = toast.loading("Saving form...");
                          try {
                            await uploadUpdatedProcoreForm(
                              qrCodeId,
                              companyData?._id,
                              String(projectData?._id || ""),
                              itemId,
                              file,
                              file.name,
                            );
                            toast.success("Form saved successfully", {
                              id: toastId,
                            });
                            setIsEditModalOpen(false);
                            try {
                              const url = new URL(window.location.href);
                              if (url.searchParams.get("openEdit"))
                                url.searchParams.delete("openEdit");
                              if (url.searchParams.get("created"))
                                url.searchParams.delete("created");
                              window.history.replaceState(
                                window.history.state,
                                "",
                                url.toString(),
                              );
                            } catch {
                              // ignore
                            }
                            try {
                              // Ask parent route to refresh the specific tool/item instead of reloading the page
                              window.dispatchEvent(
                                new CustomEvent("taliho:refreshToolData", {
                                  detail: { tool: "form", itemId },
                                }),
                              );
                            } catch {
                              // ignore
                            }
                          } catch (err) {
                            const e = err as { message?: string };
                            toast.error(e?.message || "Failed to save form", {
                              id: toastId,
                            });
                          }
                        }}
                        className={`px-4 py-2 rounded-md font-semibold ${isPdfLoaded || editedBlob ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditModalOpen(false);
                        }}
                        className="text-xl font-semibold"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  <div className="grow max-h-[80vh] w-full bg-gray-50 flex flex-col justify-start overflow-y-auto">
                    {/* Tool controls */}
                    <div className="p-2 pb-0">
                      <p className="text-sm text-gray-500 text-center">
                        Click anywhere on the PDF to add text
                      </p>
                      <p className="text-sm text-gray-500 text-center">
                        Hold and drag to move text
                      </p>
                      <button
                        onClick={() => setActiveTool("text")}
                        className={`hidden px-2 py-1 rounded ${activeTool === "text" ? "bg-gray-900 text-white" : "bg-gray-100"}`}
                      >
                        Text
                      </button>
                    </div>
                    <div ref={viewerRef} className="grow p-2 pt-0" />
                    {isSigning && (
                      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-sm text-gray-500">
                        Loading PDF…
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <UserInfoModal
        isOpen={showUserInfoModal}
        onClose={() => setShowUserInfoModal(false)}
        onSave={(info) => {
          saveCreatorInfoToStorage(info);
          setCreatorName(info.name);
          setCreatorCompany(info.company);
          setShowUserInfoModal(false);
          if (deferredEditRawUrl !== null) {
            openEditForForm(deferredEditRawUrl);
            setDeferredEditRawUrl(null);
          }
        }}
        initialName={creatorName}
        initialCompany={creatorCompany}
      />
    </div>
  );
};
