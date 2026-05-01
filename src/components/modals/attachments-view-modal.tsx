import { useState } from "react";
import { Dialog, DialogPanel, DialogBackdrop } from "@headlessui/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";

/** A single file attachment with metadata and URL. */
interface Attachment {
  /** Unique identifier for the attachment */
  id: number;
  /** MIME type (e.g., "image/jpeg", "application/pdf") */
  content_type: string;
  /** File name */
  name: string;
  /** Download/view URL */
  url: string;
  /** Whether the attachment can be viewed inline */
  viewable: boolean;
}

/** A tool/item that has file attachments. */
interface Tool {
  /** Array of file attachments belonging to this tool */
  attachments: Attachment[];
  [key: string]: unknown;
}

/** Props for the AttachmentViewModal component -- a dialog with tabbed image carousel and document grid for viewing tool attachments. */
interface AttachmentViewModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Toggle function to open/close the modal */
  handleOpen: () => void;
  /** Tool object containing the attachments to display */
  tool: Tool;
}

const FileTypeIcon = ({ type }: { type: string }) => {
  const getIcon = () => {
    if (type.startsWith("image/")) {
      return (
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    } else if (type === "application/pdf") {
      return (
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-12 h-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  return <div className="text-gray-500">{getIcon()}</div>;
};

export const AttachmentViewModal = ({
  open,
  handleOpen,
  tool,
}: AttachmentViewModalProps) => {
  const [activeTab, setActiveTab] = useState<"images" | "documents">("images");

  const imageAttachments = tool.attachments.filter((attachment) =>
    attachment.content_type.startsWith("image/"),
  );

  const documentAttachments = tool.attachments.filter(
    (attachment) => !attachment.content_type.startsWith("image/"),
  );

  const pagination = {
    clickable: true,
    renderBullet: (index: number, className: string) => {
      const isActive = className.includes("swiper-pagination-bullet-active");
      return `<span class="${className} ${
        isActive ? "bg-yellow-500" : "bg-yellow-400"
      } rounded-full px-3 py-1 mr-4 transition-colors">${index + 1}</span>`;
    },
  };
  return (
    <Dialog open={open} onClose={handleOpen} className="relative z-10">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-400/40 backdrop-blur-sm transition duration-300 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className="relative w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl duration-300 ease-out data-[closed]:opacity-0"
          >
            <div className="relative">
              <div className="flex items-center justify-between border-b p-4">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setActiveTab("images")}
                    className={`px-4 py-2 rounded-lg ${
                      activeTab === "images"
                        ? "bg-yellow-200 text-gray-800"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {" "}
                    Images ({imageAttachments.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("documents")}
                    className={`px-4 py-2 rounded-lg ${
                      activeTab === "documents"
                        ? "bg-yellow-200 text-gray-800"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {" "}
                    Documents ({documentAttachments.length})
                  </button>
                </div>
                <button
                  onClick={handleOpen}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {activeTab === "images" && imageAttachments.length > 0 && (
                <Swiper
                  pagination={pagination}
                  modules={[Pagination]}
                  className="w-full"
                >
                  {imageAttachments.map((attachment) => (
                    <SwiperSlide key={attachment.id} className="h-96">
                      <div className="flex h-[600px] items-center justify-center bg-gray-100 w-full p-4">
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              )}

              {activeTab === "documents" && (
                <div
                  className={`grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 content-center ${documentAttachments.length > 0 ? "h-[600px]" : ""}`}
                >
                  {documentAttachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center  rounded-lg border p-4 hover:bg-gray-50 h-48 "
                    >
                      <FileTypeIcon type={attachment.content_type} />
                      <p className="mt-2 text-center text-sm text-gray-900">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.content_type.split("/")[1].toUpperCase()}
                      </p>
                    </a>
                  ))}
                </div>
              )}

              {activeTab === "images" && imageAttachments.length === 0 && (
                <div className="flex h-[600px] items-center justify-center text-gray-500">
                  {" "}
                  No images available{" "}
                </div>
              )}

              {activeTab === "documents" &&
                documentAttachments.length === 0 && (
                  <div className="flex h-[600px] items-center justify-center text-gray-500">
                    {" "}
                    No documents available{" "}
                  </div>
                )}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default AttachmentViewModal;
