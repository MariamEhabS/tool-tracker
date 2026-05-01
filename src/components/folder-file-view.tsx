import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { FolderIcon } from "../assets/icons/FolderIcon";
import { FolderOutlineIcon } from "../assets/icons/FolderOutlineIcon";
import { FileTypeIcon } from "../utils/fileTypeIcon";
import { axiosInstance } from "../api";
import { getDocuments } from "../api/endpoints/tools";
import { Document, ProcoreDocumentFile, ProcoreDocumentFolder } from "../types";
import EmptyState from "./ui/EmptyState";
import { FileOutlineIcon } from "../assets/icons/FileOutlineIcon";

/** Union type for files from both Taliho local and Procore document sources */
type FileItem = Document | ProcoreDocumentFile;

/** Union type for folders from both Taliho local and Procore document sources */
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

/** Response shape from nested folder endpoint */
type NestedFolderResponse = {
  linkedFiles: FileItem[];
  linkedFolders: FolderItem[];
}[];

const File = ({
  f,
  category,
  qr,
}: {
  f: FileItem;
  category: "taliho-local" | "document";
  qr: string;
}) => {
  const filename =
    category === "taliho-local"
      ? (f as Document).documentName
      : ((f as ProcoreDocumentFile).name ?? "");
  return (
    <div
      key={filename}
      className={
        "ml-4 mb-2 text-sm flex flex-row-reverse items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white col-span-1 p-2 shadow-sm "
      }
    >
      <div className="flex justify-between">
        <button className="bg-white hover:bg-gray-100 text-gray-800 font-semibold px-2 border border-gray-200 rounded shadow">
          i
        </button>
      </div>
      {category === "document" && (
        <div className="flex items-center px-4 gap-4">
          <FileTypeIcon type={filename} />
          <p
            onClick={async () => {
              const docFile = f as ProcoreDocumentFile;
              const fileVersions = docFile.file_versions || [];
              const [latest] = fileVersions;
              if (!latest?.url) return;
              const response = await axiosInstance.post<unknown>(
                `/document?qrcodeId=${qr}`,
                {
                  url: latest.url,
                },
                { responseType: "blob" },
              );

              const file = new Blob([response.data as BlobPart], {
                type: response.headers["content-type"],
              });
              const fileURL = URL.createObjectURL(file);
              window.open(fileURL, "_blank");
            }}
          >
            {filename}
          </p>
        </div>
      )}
      {category !== "document" && (
        <div className="flex items-center px-4 gap-4">
          <FileTypeIcon type={filename} />
          <p
            onClick={async () => {
              const localFile = f as Document;
              const { data } = await axiosInstance.get<string>(
                `/document/signed-url?documentId=${localFile._id}&qrcodeId=${qr}`,
              );
              window.open(data, "_blank");
              return data;
            }}
          >
            {filename}
          </p>
        </div>
      )}
    </div>
  );
};

const Folder = ({
  f,
  category,
  qr,
}: {
  f: FolderItem;
  category: "taliho-local" | "document";
  qr: string;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const id = category === "taliho-local" ? f._id : f.procoreItemID || f.id;
  const folderName = category === "taliho-local" ? f.folderName : f.name;
  const [linkedFolders, setLinkedFolders] = useState<FolderItem[] | undefined>(
    f.linkedFolders,
  );
  const [linkedFiles, setLinkedFiles] = useState<FileItem[] | undefined>(
    f.linkedFiles,
  );

  const companyId = useSelector((state: RootState) => state.company._id);
  const projectId = useSelector((state: RootState) => state.project._id);

  useEffect(() => {
    (async function () {
      if (isOpen) {
        if (category === "taliho-local") {
          const params = new URLSearchParams({ companyId });
          if (projectId) params.set("projectId", projectId);
          const { data } = await axiosInstance.get<NestedFolderResponse>(
            `/folder/nested-for-mobile/${id}?${params.toString()}`,
          );
          if (data && data[0]) {
            setLinkedFolders(data[0].linkedFolders);
            setLinkedFiles(data[0].linkedFiles);
          }
        }
        if (category === "document") {
          await getDocuments(qr, companyId, projectId, String(f.id || ""));
          setLinkedFolders(f.folders as FolderItem[] | undefined);
          setLinkedFiles(f.files as FileItem[] | undefined);
        }
      }
    })();
  }, [
    isOpen,
    category,
    id,
    companyId,
    projectId,
    qr,
    linkedFolders,
    linkedFiles,
    f,
  ]);

  return (
    <div className="ml-4 border border-gray-100">
      <div
        key={id}
        className={` flex items-center px-4 justify-between box-shadow shadow-lg py-4 category-button relative text-sm border border-gray-200 bg-white rounded-md min-w-[30%] mb-2`}
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        <div className="flex items-center gap-4 ">
          <FolderIcon />
          <span className="font-semibold">{folderName}</span>
        </div>

        <span className="font-semibold">Files: {linkedFiles?.length}</span>
      </div>
      {isOpen &&
        linkedFolders?.map((folder, idx) => (
          <Folder
            f={folder}
            category={category}
            qr={qr}
            key={folder._id || folder.id || idx}
          />
        ))}
      {isOpen &&
        linkedFiles?.map((file, idx) => (
          <File
            f={file}
            category={category}
            qr={qr}
            key={
              (file as Document)._id || (file as ProcoreDocumentFile).id || idx
            }
          />
        ))}
      {isOpen && linkedFiles?.length === 0 && linkedFolders?.length === 0 && (
        <p
          className={
            "flex items-center gap-2 rounded-lg border border-gray-50 bg-white col-span-1 p-2 shadow-sm ml-4 mb-2"
          }
        >
          No files or folders {f.folderName}
        </p>
      )}
    </div>
  );
};
export const FolderFileViewLocal = ({
  category,
}: {
  category: "taliho-local";
}) => {
  const router = useRouter();
  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;

  const { files, folders } = useSelector(
    (state: RootState) => state.folderFile[category],
  );
  if (!files && !folders) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  return (
    <>
      {!folders || folders.length === 0 ? (
        <EmptyState
          icon={<FolderOutlineIcon className="h-8 w-8 text-gray-400" />}
          title="No folders"
          description="This location doesn't have any folders yet."
          compact
          className="ml-4 mb-2"
        />
      ) : (
        folders.map((f, idx) => (
          <Folder
            category={category}
            f={f as FolderItem}
            qr={qrCodeIdInURL!}
            key={(f as FolderItem).folderName || idx}
          />
        ))
      )}
      {!files || files.length === 0 ? (
        <EmptyState
          icon={<FileOutlineIcon className="h-8 w-8 text-gray-400" />}
          title="No files"
          description="This location doesn't have any files yet."
          compact
          className="ml-4 mb-2"
        />
      ) : (
        files.map((f, idx) => (
          <File
            f={f as FileItem}
            category={category}
            qr={qrCodeIdInURL!}
            key={(f as Document)._id || (f as ProcoreDocumentFile).id || idx}
          />
        ))
      )}
    </>
  );
};
export const FolderFileView = ({ category }: { category: "document" }) => {
  const router = useRouter();
  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;

  const { folders, files } = useSelector(
    (state: RootState) => state.folderFile.document,
  );

  if (!files && !folders) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {!folders || folders.length === 0 ? (
        <EmptyState
          icon={<FolderOutlineIcon className="h-8 w-8 text-gray-400" />}
          title="No folders"
          description="This location doesn't have any folders yet."
          compact
          className="ml-4 mb-2"
        />
      ) : (
        folders.map((f, idx) => (
          <Folder
            category={category}
            f={f as FolderItem}
            qr={qrCodeIdInURL!}
            key={(f as FolderItem).folderName || idx}
          />
        ))
      )}

      {!files || files.length === 0 ? (
        <EmptyState
          icon={<FileOutlineIcon className="h-8 w-8 text-gray-400" />}
          title="No files"
          description="This location doesn't have any files yet."
          compact
          className="ml-4 mb-2"
        />
      ) : (
        files.map((f, idx) => (
          <File
            f={f as FileItem}
            category={category}
            qr={qrCodeIdInURL!}
            key={(f as ProcoreDocumentFile).id || (f as Document)._id || idx}
          />
        ))
      )}
    </>
  );
};
