import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { useRouter } from "@tanstack/react-router";
import { FolderIcon } from "../assets/icons/FolderIcon";
import { logDocumentError } from "@/utils/rollbar";
import { FileTypeIcon } from "../utils/fileTypeIcon";
import { axiosInstance } from "../api";
import { getFolders, getSignedProcoreUrl } from "../api/endpoints/tools";
import { getS3PresignedUrl } from "../api/endpoints/document";
import { chooseFolder, goBack } from "../store/slices/folderRecurseSlice";
import useDeviceDetection from "../utils/hooks/deviceDetect";
import toast from "react-hot-toast";
import { Toast } from "../utils/toaster/toast";
import {
  useState,
  useEffect,
  useRef,
  useId,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { GoBackIcon } from "../assets/icons/GoBackIcon";
import { PdfOpener } from "./pdf-opener";
import { Document, ProcoreDocumentFile, ProcoreDocumentFolder } from "../types";

/** File item for local Taliho documents - extends Document with extra fields */
type LocalFileItem = Document & {
  addedLink?: boolean;
};

/** File item for Procore documents */
type ProcoreFileItem = ProcoreDocumentFile & {
  openToPage?: number;
};

/** Union type for all file items */
type FileItem = LocalFileItem | ProcoreFileItem;

/** Folder item for local Taliho folders */
type FolderItem = {
  _id?: string;
  id?: string | number;
  procoreItemID?: string | number;
  folderName?: string;
  name?: string;
  linkedFolders?: FolderItem[];
  linkedFiles?: FileItem[];
  folders?: ProcoreDocumentFolder[];
  files?: ProcoreDocumentFile[];
};

// NestedFolderResponse type removed - not used in this file

const File = ({
  f,
  category,
  setClickedFile,
  setLocalDocumentId,
  setOpenToPage,
  formId,
  isMobile,
}: {
  f: FileItem;
  category: "taliho-local" | "document";
  setClickedFile?: Dispatch<SetStateAction<ProcoreFileItem | null>>;
  setLocalDocumentId?: Dispatch<SetStateAction<string>>;
  setOpenToPage?: Dispatch<SetStateAction<number | undefined>>;
  formId: string;
  isMobile?: boolean;
}) => {
  const [isLoading] = useState(false);
  const filename =
    category === "taliho-local"
      ? (f as LocalFileItem).documentName
      : ((f as ProcoreFileItem).name ?? "");
  const linkRef = useRef<HTMLAnchorElement>(null);

  if (
    (category === "taliho-local" && !setLocalDocumentId) ||
    (category === "document" && !setClickedFile)
  ) {
    throw new Error("Missing set state function in <File />");
  }

  const handleTalihoDocs = async () => {
    const localFile = f as LocalFileItem;
    if (localFile.addedLink) {
      window.open(localFile.documentFile, "_blank");
      return;
    }
    setClickedFile!(null);
    setLocalDocumentId!(localFile._id);
    setOpenToPage?.(localFile.openToPage);
  };
  const handleProcoreDocs = async () => {
    if (isLoading) return;
    setLocalDocumentId!("");
    setClickedFile!(f as ProcoreFileItem);
    setOpenToPage?.((f as ProcoreFileItem).openToPage);
  };

  return (
    <button
      type={isMobile ? "button" : "submit"}
      form={isMobile ? undefined : formId}
      key={filename}
      className={
        "mb-2 text-sm flex flex-row items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white col-span-1 p-2 shadow-sm"
      }
      onClick={category === "document" ? handleProcoreDocs : handleTalihoDocs}
    >
      {category === "document" && (
        <div className="flex items-center px-4 gap-4">
          <FileTypeIcon type={filename} />

          <p className="text-left hover:underline">
            {isLoading ? "Opening..." : filename}
          </p>
        </div>
      )}
      {category !== "document" && (
        <div className="flex items-center px-4 gap-4 flex-1 min-w-0">
          <FileTypeIcon
            type={filename}
            isLink={!!(f as LocalFileItem).addedLink}
          />
          <p className="truncate">{filename}</p>
        </div>
      )}
      <a href="" className="hidden" ref={linkRef} rel="noopener noreferrer">
        link
      </a>
    </button>
  );
};

const Folder = ({
  f,
  category,
  setIsDataLoading,
  openFolder,
}: {
  f: FolderItem;
  category: "taliho-local" | "document";
  setIsDataLoading: React.Dispatch<React.SetStateAction<boolean>>;
  openFolder: (folderId: string, folderName: string) => Promise<void>;
}) => {
  const id = category === "taliho-local" ? (f._id ?? "") : String(f.id || "");
  const folderName =
    category === "taliho-local" ? (f.folderName ?? "") : (f.name ?? "");

  return (
    <div>
      <div
        key={id}
        className={`flex items-center px-4 justify-between box-shadow shadow-md py-1 category-button relative text-sm border border-gray-200 bg-white rounded-md min-w-[30%] mb-2`}
        onClick={() => {
          setIsDataLoading(true);
          openFolder(id, folderName);
          setIsDataLoading(false);
        }}
      >
        <div className="flex items-center gap-4 ">
          <FolderIcon />
          <span className="font-semibold">{folderName}</span>
        </div>
      </div>
    </div>
  );
};

export const FoldersView = ({
  parentId,
  category,
  openFolder,
  stylePosition,
  setClickedFile,
  setLocalDocumentId,
  setOpenToPage,
  pdfFormId,
  isMobile,
}: {
  parentId: string;
  category: "taliho-local" | "document";
  openFolder: (folderId: string, folderName: string) => Promise<void>;
  stylePosition: (distance: number, offset: boolean) => string;
  setClickedFile: Dispatch<SetStateAction<ProcoreFileItem | null>>;
  setLocalDocumentId: Dispatch<SetStateAction<string>>;
  setOpenToPage: Dispatch<SetStateAction<number | undefined>>;
  pdfFormId: string;
  isMobile?: boolean;
}) => {
  const dispatch = useDispatch();
  const { currentLocation, childrenOf, breadcrumbs } = useSelector(
    (state: RootState) => state.folderRecurse,
  );
  const data = useSelector((state: RootState) => state.folderFile[category]);
  const { files, folders } = parentId === "root" ? data : childrenOf[parentId];
  const { position, folderName } = childrenOf[parentId];
  const prevFolderName =
    position === 0 ? null : childrenOf[breadcrumbs[position - 1]].folderName;

  const [isDataLoading, setIsDataLoading] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);
  const getPositionClass = () => {
    if (!isMounted) return "translate-x-full";
    return stylePosition(position - currentLocation, isDataLoading);
  };
  const isEmpty =
    (!Array.isArray(folders) && !Array.isArray(files)) ||
    (folders?.length === 0 && files?.length === 0);
  return (
    <div
      className={`absolute top-0 left-0 w-full flex flex-col h-fit min-h-[80vh] gap-2 transition-transform duration-500 ease-in-out ${getPositionClass()}`}
    >
      {prevFolderName ? (
        <div className="flex flex-col gap-2 border border-t-0 border-x-0 border-b-2 border-gray-300 mb-3">
          <div
            className={`flex items-center px-4 justify-start gap-2 py-1.5 relative bg-white rounded-md min-w-[30%] text-md border border-gray-300 text-gray-600`}
            onClick={() => {
              dispatch(goBack());
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {position !== 0 && (
              <button>
                <GoBackIcon />
              </button>
            )}
            <span className="font-bold">{prevFolderName}</span>
          </div>

          <h2
            className={`flex items-center px-2 justify-start relative py-2 bg-white rounded-md min-w-[30%] text-lg`}
          >
            <span className="font-bold">{folderName}</span>
          </h2>
        </div>
      ) : (
        <div className="h-[0.25lh]"></div>
      )}
      {isEmpty && (
        <p
          className={`flex items-center px-4 justify-between box-shadow shadow-lg py-4 category-button relative text-sm border border-gray-200 bg-white rounded-md min-w-[30%] mb-2`}
        >
          Folder is empty
        </p>
      )}
      {!isEmpty &&
        folders?.map((f, i) => (
          <Folder
            setIsDataLoading={setIsDataLoading}
            category={category}
            f={f as FolderItem}
            key={i}
            openFolder={openFolder}
          />
        ))}
      {!isEmpty &&
        files?.map((f, i) => (
          <File
            setClickedFile={setClickedFile}
            setLocalDocumentId={setLocalDocumentId}
            setOpenToPage={setOpenToPage}
            category={category}
            f={f}
            formId={pdfFormId}
            isMobile={isMobile}
            key={i}
          />
        ))}
    </div>
  );
};

export const FoldersViewWrapper = ({
  category,
}: {
  category: "taliho-local" | "document" | "folder";
}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;
  const companyId = useSelector((state: RootState) => state.company._id);
  const projectId = useSelector((state: RootState) => state.project._id);
  const { breadcrumbs, childrenOf } = useSelector(
    (state: RootState) => state.folderRecurse,
  );
  const [, setIsLoading] = useState(false);
  const [clickedFile, setClickedFile] = useState<ProcoreFileItem | null>(null);
  const [localDocumentId, setLocalDocumentId] = useState("");
  const [openToPage, setOpenToPage] = useState<number | undefined>(undefined);
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;

  // Mobile detection and presigned URL state for inline PDF viewer
  const device = useDeviceDetection();
  const isMobile = device === "Mobile" || device === "Tablet";
  const [presignedUrl, setPresignedUrl] = useState<string | undefined>(
    undefined,
  );
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Handler to clear all document state when PDF viewer is closed
  const handlePdfClose = useCallback(() => {
    setLocalDocumentId("");
    setPresignedUrl(undefined);
    setClickedFile(null);
    setOpenToPage(undefined);
  }, []);

  // Fetch presigned URL when a document is selected on mobile
  useEffect(() => {
    if (!localDocumentId || !isMobile) {
      setPresignedUrl(undefined);
      return;
    }

    let cancelled = false;
    setIsLoadingUrl(true);

    const fetchUrl = async () => {
      try {
        const url = await getS3PresignedUrl(localDocumentId, companyId);
        if (cancelled || !url) return;

        // Check if the file is a PDF by examining the URL path.
        // Non-PDF files (docx, xlsx, images, etc.) can't be rendered by
        // the PDF.js viewer — open them directly in a new tab instead.
        const pathname = new URL(url).pathname;
        const isPdf = pathname.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          setPresignedUrl(url);
        } else {
          window.open(url, "_blank");
          setLocalDocumentId("");
          setOpenToPage(undefined);
        }
      } catch (error) {
        logDocumentError(error, "fetch-presigned-url", { localDocumentId });
        if (!cancelled) {
          toast.error("Failed to load document. Please try again.");
          setLocalDocumentId("");
          setOpenToPage(undefined);
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
  }, [localDocumentId, isMobile, companyId]);

  // Fetch Procore signed URL when a Procore file is selected on mobile
  useEffect(() => {
    if (!clickedFile || !isMobile) {
      return;
    }

    const fileUrl = clickedFile.file_versions?.[0]?.url;
    if (!fileUrl) {
      logDocumentError(
        new Error("Procore file missing file_versions URL"),
        "procore-missing-file-url",
        { fileName: clickedFile.name },
      );
      toast.error("This file is unavailable. Please try again.");
      setClickedFile(null);
      setOpenToPage(undefined);
      return;
    }

    if (!qrCodeIdInURL) {
      toast.error("Failed to load document. Please try again.");
      setClickedFile(null);
      setOpenToPage(undefined);
      return;
    }

    let cancelled = false;
    setIsLoadingUrl(true);

    const fetchProcoreUrl = async () => {
      try {
        const url = await getSignedProcoreUrl({
          qrCodeId: qrCodeIdInURL,
          fileUrl,
          urlOnly: true,
        });
        if (cancelled || !url || typeof url !== "string") return;

        // Detect file type from the Procore filename rather than the signed
        // URL path, which may not preserve the original extension.
        const fileName = clickedFile.name ?? "";
        const isPdf = fileName.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          setPresignedUrl(url);
        } else {
          window.open(url, "_blank");
          setClickedFile(null);
          setOpenToPage(undefined);
        }
      } catch (error) {
        logDocumentError(error, "fetch-procore-signed-url", {
          fileName: clickedFile.name,
          fileUrl,
        });
        if (!cancelled) {
          toast.error("Failed to load document. Please try again.");
          setClickedFile(null);
          setOpenToPage(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUrl(false);
        }
      }
    };

    fetchProcoreUrl();

    return () => {
      cancelled = true;
    };
  }, [clickedFile, isMobile, qrCodeIdInURL]);

  const procoreToolChanger = (tool: "taliho-local" | "document" | "folder") => {
    if (tool === "taliho-local") return tool;
    return "document";
  };

  const openFolder = async (folderId: string, folderName: string) => {
    setIsLoading(true);
    setClickedFile(null);
    setLocalDocumentId("");
    setOpenToPage(undefined);
    try {
      if (!(folderId in childrenOf)) {
        if (category === "document") {
          const data = (await getFolders(
            qrCodeIdInURL!,
            companyId,
            projectId,
            folderId,
          )) as { files: []; folders: [] };
          dispatch(
            chooseFolder({
              id: folderId,
              files: data.files,
              folders: data.folders,
              folderName,
            }),
          );
        } else {
          const params = new URLSearchParams({ companyId });
          if (projectId) params.set("projectId", projectId);
          const { data: responseData } = await axiosInstance.get<{
            success_message: string;
            data: { linkedFiles: []; linkedFolders: [] } | null;
          }>(
            `/folder/nested-for-mobile/${folderId}?${params.toString()}`,
          );
          const { linkedFiles, linkedFolders } = responseData.data || {
            linkedFiles: [],
            linkedFolders: [],
          };
          dispatch(
            chooseFolder({
              id: folderId,
              files: linkedFiles,
              folders: linkedFolders,
              folderName,
            }),
          );
        }
      }
      dispatch(chooseFolder({ id: folderId, folderName }));
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 50);
      document.body.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const stylePosition = (distance: number, isLoading: boolean) => {
    const baseClasses = "transition-transform duration-300 ease-in-out";

    if (isLoading && distance > 0) {
      return `${baseClasses} translate-x-[110%]`;
    }
    if (distance < 0) {
      return `${baseClasses} -translate-x-[110%]`;
    } else if (distance === 0) {
      return `${baseClasses} translate-x-0`;
    } else {
      return `${baseClasses} translate-x-[110%]`;
    }
  };

  return (
    <div className="relative min-h-[80vh] col-span-2">
      <Toast />
      <PdfOpener
        clickedFile={clickedFile}
        documentId={localDocumentId}
        formId={pdfFormId}
        openToPage={openToPage}
        useInlineViewer={isMobile}
        presignedUrl={presignedUrl}
        onViewerClose={handlePdfClose}
      />
      {/* Loading overlay for mobile document fetching */}
      {isLoadingUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3 shadow-xl">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700 font-medium">
              Loading document...
            </span>
          </div>
        </div>
      )}
      {breadcrumbs.map((b, i) => (
        <FoldersView
          parentId={b}
          category={procoreToolChanger(category)}
          openFolder={openFolder}
          stylePosition={stylePosition}
          setClickedFile={setClickedFile}
          setLocalDocumentId={setLocalDocumentId}
          setOpenToPage={setOpenToPage}
          pdfFormId={pdfFormId}
          isMobile={isMobile}
          key={i}
        />
      ))}
    </div>
  );
};
