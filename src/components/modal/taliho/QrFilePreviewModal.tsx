import Modal from "@components/modal/Modal";
import Button from "@components/ui/Button";

type Props = {
  open: boolean;
  title: string;
  type?: string;
  downloadHref?: string;
  downloadName?: string;
  onClose: () => void;
  content: React.ReactNode;
};

export default function QrFilePreviewModal({
  open,
  title,
  type,
  downloadHref,
  downloadName,
  onClose,
  content,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={type ? `Type: ${type}` : undefined}
      size={
        ["PDF", "URL", "JPG", "PNG", "MP4", "MOV", "TXT"].includes(type || "")
          ? "2xl"
          : "md"
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {downloadHref ? (
            <a
              href={downloadHref}
              download={downloadName || true}
              className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Download
            </a>
          ) : null}
        </>
      }
    >
      <div className="min-h-[300px] flex flex-col border border-gray-200">
        {content}
      </div>
    </Modal>
  );
}
