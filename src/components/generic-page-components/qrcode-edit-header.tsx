import { useState, useEffect } from "react";
import { DownloadIcon } from "../../assets/icons/DownloadIcon";
import { PrintIcon } from "../../assets/icons/PrintIcon";
import { ShareIcon } from "../../assets/icons/ShareIcon";
import { QRCode } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import toast from "react-hot-toast";
import { updateQRCodeDetails } from "../../api/endpoints/qr-codes";
import { getStoredUser } from "@/utils/getStoredUser";

interface QRCodeEditorHeaderProps {
  data: QRCode;
  companyId: string;
  projectId?: string;
  onUpdateSuccess?: (updatedData: QRCode) => void;
  setIsEditing: (isEditing: boolean) => void;
}

interface PatchQRCodeDto {
  companyId: string;
  projectId?: string;
  qrcodeName?: string;
  groupingId?: string;
  groupingType?: string;
  description?: string;
}

interface UpdateQRCodeResponse {
  success_message?: string;
  data?: {
    data?: {
      project?: string;
      qrcodeName?: string;
      description?: string;
    };
  };
}

export const QRCodeEditorHeader: React.FC<QRCodeEditorHeaderProps> = ({
  data,
  companyId,
  projectId,
  onUpdateSuccess,
  setIsEditing,
}) => {
  const user = getStoredUser();
  const userCompanyId = user?.companyId;

  const [formData, setFormData] = useState<PatchQRCodeDto>({
    companyId: user?.companyId,
    projectId: data?.data?.project,
    qrcodeName: data?.data?.qrcodeName || "",
    // groupingId: data?.data?.groupingId || '',
    // groupingType: data?.data?.groupingType || '',
    description: data?.data?.description || "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        companyId: userCompanyId,
        projectId: data?.data?.project,
        qrcodeName: data.data?.qrcodeName || "",
        // groupingId: data.data?.groupingId || '',
        // groupingType: data.data?.groupingType || '',
        description: data.data?.description || "",
      });
    }
  }, [data, userCompanyId]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveChanges = async () => {
    if (!data?.data?._id) return;

    setIsLoading(true);
    try {
      const response = (await updateQRCodeDetails(
        data.data._id,
        formData,
      )) as UpdateQRCodeResponse;

      if (response?.success_message) {
        toast.success(response.success_message);
      } else {
        toast.success("QR code updated successfully.");
      }

      const responseData = response?.data?.data;
      setFormData({
        companyId: user?.companyId,
        projectId: responseData?.project,
        qrcodeName: responseData?.qrcodeName || "",
        description: responseData?.description || "",
      });

      if (onUpdateSuccess && responseData) {
        onUpdateSuccess(responseData as unknown as QRCode);
      }
      setIsEditing(false);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error updating QR code:", error);
      }
      toast.error(
        (error as { message?: string })?.message || "An error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handleCancel = () => {
    setFormData({
      companyId,
      projectId,
      qrcodeName: data.data?.qrcodeName || "",
      // groupingId: data.data?.groupingId || '',
      // groupingType: data.data?.groupingType || '',
      description: data.data?.description || "",
    });
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-stretch bg-white rounded-lg shadow-sm p-4">
      <div className="md:w-1/3 flex justify-center items-start md:items-center mb-4 md:mb-0">
        <div className="flex flex-col items-center space-y-4">
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
          <div className="w-full">
            <label
              htmlFor="qrcodeName"
              className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1"
            >
              QR Code Name
            </label>
            <input
              id="qrcodeName"
              name="qrcodeName"
              type="text"
              value={formData.qrcodeName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="hidden md:block border-l border-gray-200 mx-4"></div>

      {/* Main Content Section */}
      <div className="flex-1 md:pl-4">
        {/* Header with Type/Project */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Editing QR Code
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="groupingType"
                  className="block text-xs font-medium text-gray-500 mb-1"
                >
                  Type
                </label>
                <select
                  id="groupingType"
                  name="groupingType"
                  value={formData.groupingType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm capitalize"
                >
                  <option value="">Select type</option>
                  <option value="equipment">Equipment</option>
                  <option value="arrangement">Arrangement</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="groupingId"
                  className="block text-xs font-medium text-gray-500 mb-1"
                >
                  Grouping ID
                </label>
                <input
                  id="groupingId"
                  name="groupingId"
                  type="text"
                  value={formData.groupingId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter grouping ID"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Description Editor */}
        <div className="mb-4">
          <label
            htmlFor="description"
            className="block text-xs font-medium text-gray-500 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Add a description for this QR code..."
          />
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 mb-4">
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
            {/* <p className="text-sm font-medium"> */}
            {/* {data?.data?.lastScannedAt ? formatProcoreTime(`${data?.data?.lastScannedAt}`) : 'Never'}
						</p> */}
          </div>
        </div>

        {/* URL Section */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md mb-4">
          <div className="flex items-center overflow-hidden">
            <i className="bx bx-link text-blue-600 mr-2 flex-shrink-0"></i>
            <span className="text-sm text-blue-600 truncate">
              {data?.data?.url}
            </span>
          </div>
          <button
            className="text-sm text-blue-700 font-medium hover:text-blue-800 whitespace-nowrap"
            onClick={() => {
              navigator.clipboard.writeText(data?.data?.url || "");
            }}
          >
            Copy Link
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex space-x-2">
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

          <div className="flex space-x-2">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              type="button"
              className="inline-flex items-center rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:scale-95 transition duration-150 ease-in-out disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isLoading}
              type="button"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline  focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95 transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
