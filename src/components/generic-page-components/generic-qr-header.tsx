import { useState } from "react";
import { DownloadIcon } from "../../assets/icons/DownloadIcon";
import { EditIcon } from "../../assets/icons/EditIcon";
import { PrintIcon } from "../../assets/icons/PrintIcon";
import { ShareIcon } from "../../assets/icons/ShareIcon";
import { QRCode } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { QRCodeEditorHeader } from "./qrcode-edit-header";
import { getStoredUser } from "@/utils/getStoredUser";

interface HeaderProps {
  data?: QRCode;
  codeName?: string;
}

export const GenericQRHeader: React.FC<HeaderProps> = ({ data, codeName }) => {
  const user = getStoredUser();

  const [editingQRCode, setEditingQRCode] = useState(false);

  const handleEditClick = () => {
    setEditingQRCode(true);
  };
  if (!data || !data.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (editingQRCode) {
    return (
      <QRCodeEditorHeader
        data={data}
        setIsEditing={setEditingQRCode}
        companyId={user?.companyId}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-stretch">
      <div className="md:w-1/3 flex justify-center items-start md:items-center mb-4 md:mb-0">
        <div className="flex flex-col items-center">
          <div className="p-4 bg-white border border-gray-100 rounded-lg shadow-sm w-56 h-56 flex items-center justify-center">
            <img
              src={
                data?.data?.qrImageUrl
                  ? String(data.data.qrImageUrl)
                  : `data:image/svg+xml;base64,${btoa(`${data?.data?.qrimage}`)}`
              }
              alt="QR Code"
              className="w-full h-full"
            />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
            {data?.data?.qrcodeName}
          </p>
        </div>
      </div>

      <div className="hidden md:block border-l border-gray-200"></div>

      <div className="flex-1 md:pl-8">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="flex items-center">
              <i className="bx bx-file text-blue-600 text-xl mr-2"></i>
              <h1 className="text-2xl font-semibold text-gray-900">
                {codeName}
              </h1>
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
                {data?.data?.type}
              </span>
              <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                {data?.data?.projectName}
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleEditClick}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:scale-95 transition duration-150 ease-in-out"
            >
              <EditIcon className="!size-5 text-gray-500" />
              Edit
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-2 mb-4">
          {data?.data?.description || `This QR Code doesn't have a description`}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm font-medium">
              {formatProcoreTime(`${data?.data?.createdAt}`)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Scans</p>
            <p className="text-sm font-medium">
              {data?.data?.mobileScanCount || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last Scanned</p>
            <p className="text-sm font-medium">Today, 10:23 AM</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 p-2 bg-blue-50 rounded-md">
          <div className="flex items-center">
            <i className="bx bx-link text-blue-600 mr-2"></i>
            <span className="text-sm text-blue-600">{data?.data?.url}</span>
          </div>
          <button className="text-sm text-blue-700 font-medium hover:text-blue-800">
            Copy Link
          </button>
        </div>

        <div className="flex space-x-2 mt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:scale-95 transition duration-150 ease-in-out"
          >
            <DownloadIcon />
            Download
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:scale-95 transition duration-150 ease-in-out"
          >
            <ShareIcon />
            Share
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm/6 font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:scale-95 transition duration-150 ease-in-out"
          >
            <PrintIcon />
            Print
          </button>
        </div>
      </div>
    </div>
  );
};
