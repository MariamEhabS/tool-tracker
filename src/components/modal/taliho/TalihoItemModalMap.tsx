import type { ReactNode } from "react";
import EditModal, { type EditField } from "@components/modal/taliho/EditModal";
import UploadModal from "@components/modal/taliho/UploadModal";
import MoveModal, {
  type FolderOption,
} from "@components/modal/taliho/MoveModal";
import DeleteModal from "@components/modal/taliho/DeleteModal";
import BulkMoveModal from "@components/modal/taliho/BulkMoveModal";
import BulkDeleteModal from "@components/modal/taliho/BulkDeleteModal";

type DocEditProps = {
  open: boolean;
  fields: EditField[];
  onConfirm: (values: Record<string, string>) => void;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
};

type DocUploadProps = {
  open: boolean;
  onConfirm: (files: File[]) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

type DocMoveProps = {
  open: boolean;
  onConfirm: (destinationFolderId: string) => void;
  onClose: () => void;
  subjectLabel?: string;
  folderOptions?: FolderOption[];
  initialFolder?: string;
  currentFolderId?: string;
  validateFolder?: (
    folderId: string,
  ) => Promise<{ exists: boolean; accessible: boolean; message?: string }>;
};

type DocDeleteProps = {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  title?: string;
  subjectLabel?: string;
  subtitle?: ReactNode;
  bodyMessage?: string;
};

type BulkDocDeleteProps = {
  open: boolean;
  selectedCount: number;
  subjectLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  bodyMessage?: string;
};

type BulkUploadProps = {
  open: boolean;
  onConfirm: (files: File[]) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

type BulkMoveProps = {
  open: boolean;
  selectedCount: number;
  subjectLabel: string;
  onConfirm: (destinationFolderId: string) => void;
  onClose: () => void;
  folderOptions?: FolderOption[];
  initialFolder?: string;
  currentFolderId?: string;
  validateFolder?: (
    folderId: string,
  ) => Promise<{ exists: boolean; accessible: boolean; message?: string }>;
};

type HideRemoveProps = {
  open: boolean;
  title: string;
  bodyMessage: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

type BulkHideRemoveProps = {
  open: boolean;
  selectedCount: number;
  subjectLabel: string;
  title: string;
  bodyMessage: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

type TalihoItemModalMapProps = {
  docEdit: DocEditProps;
  docUpload: DocUploadProps;
  docMove: DocMoveProps;
  docDelete: DocDeleteProps;
  bulkDocDelete: BulkDocDeleteProps;
  bulkUpload: BulkUploadProps;
  bulkMove: BulkMoveProps;
  bulkDelete: BulkDocDeleteProps;
  hideRemove: HideRemoveProps;
  bulkHideRemove: BulkHideRemoveProps;
};

export default function TalihoItemModalMap(props: TalihoItemModalMapProps) {
  const {
    docEdit,
    docUpload,
    docMove,
    docDelete,
    bulkDocDelete,
    bulkUpload,
    bulkMove,
    bulkDelete,
    hideRemove,
    bulkHideRemove,
  } = props;

  return (
    <>
      {/* Single-item modals */}
      <EditModal
        open={docEdit.open}
        onClose={docEdit.onClose}
        fields={docEdit.fields}
        title={docEdit.title ?? "Edit Document"}
        subtitle={docEdit.subtitle}
        onConfirm={docEdit.onConfirm}
      />
      <UploadModal
        open={docUpload.open}
        onClose={docUpload.onClose}
        title={docUpload.title ?? "Upload to Folder"}
        subtitle={docUpload.subtitle}
        onConfirm={(files) => docUpload.onConfirm(files)}
      />
      <MoveModal
        open={docMove.open}
        onClose={docMove.onClose}
        subjectLabel={docMove.subjectLabel ?? "document"}
        onConfirm={(folderId) => docMove.onConfirm(folderId)}
        folderOptions={docMove.folderOptions}
        initialFolder={docMove.initialFolder}
        currentFolderId={docMove.currentFolderId}
        validateFolder={docMove.validateFolder}
      />
      <DeleteModal
        open={docDelete.open}
        onClose={docDelete.onClose}
        title={docDelete.title ?? "Delete Document"}
        subjectLabel={docDelete.subjectLabel ?? "document"}
        subtitle={docDelete.subtitle}
        bodyMessage={
          docDelete.bodyMessage ??
          "This document will be moved to trash and permanently deleted after 30 days."
        }
        onConfirm={docDelete.onConfirm}
      />

      {/* Bulk document delete (preconfigured title) */}
      <BulkDeleteModal
        open={bulkDocDelete.open}
        onClose={bulkDocDelete.onClose}
        selectedCount={bulkDocDelete.selectedCount}
        subjectLabel={bulkDocDelete.subjectLabel}
        title={bulkDocDelete.title ?? "Delete Documents"}
        bodyMessage={bulkDocDelete.bodyMessage}
        onConfirm={bulkDocDelete.onConfirm}
      />

      {/* Bulk action modals */}
      <UploadModal
        open={bulkUpload.open}
        onClose={bulkUpload.onClose}
        title={bulkUpload.title ?? "Upload Documents"}
        subtitle={bulkUpload.subtitle}
        onConfirm={(files) => bulkUpload.onConfirm(files)}
      />
      <BulkMoveModal
        open={bulkMove.open}
        onClose={bulkMove.onClose}
        selectedCount={bulkMove.selectedCount}
        subjectLabel={bulkMove.subjectLabel}
        onConfirm={(folderId) => bulkMove.onConfirm(folderId)}
        folderOptions={bulkMove.folderOptions}
        initialFolder={bulkMove.initialFolder}
        currentFolderId={bulkMove.currentFolderId}
        validateFolder={bulkMove.validateFolder}
      />
      <BulkDeleteModal
        open={bulkDelete.open}
        onClose={bulkDelete.onClose}
        selectedCount={bulkDelete.selectedCount}
        subjectLabel={bulkDelete.subjectLabel}
        title={bulkDelete.title}
        subtitle={bulkDelete.subtitle}
        bodyMessage={bulkDelete.bodyMessage}
        onConfirm={bulkDelete.onConfirm}
      />

      {/* Hide / Remove modals */}
      <DeleteModal
        open={hideRemove.open}
        onClose={hideRemove.onClose}
        title={hideRemove.title}
        bodyMessage={hideRemove.bodyMessage}
        confirmLabel={hideRemove.confirmLabel}
        onConfirm={hideRemove.onConfirm}
      />
      <BulkDeleteModal
        open={bulkHideRemove.open}
        onClose={bulkHideRemove.onClose}
        selectedCount={bulkHideRemove.selectedCount}
        subjectLabel={bulkHideRemove.subjectLabel}
        title={bulkHideRemove.title}
        bodyMessage={bulkHideRemove.bodyMessage}
        onConfirm={bulkHideRemove.onConfirm}
      />
    </>
  );
}
