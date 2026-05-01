import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { formatFileSize } from "../../utils/formatFileSize";

interface DocumentsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
}

export const DocumentsPageComponent = ({
  procoreData,
  projectData,
}: DocumentsPageComponentProps) => {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="bg-white rounded-lg p-2">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {projectData.projectName}
          </h1>
          <p className="text-gray-600">
            {projectData.projectAddress}
            <br />
            {`${projectData.projectCity}, ${projectData.projectState} ${projectData.projectZIP}`}
          </p>
        </div>
      </div>
      {procoreData.map((data, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900">
                  #{data.procoreItemID}
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {data.name}
                </h2>
              </div>
              <span className="text-sm font-medium text-gray-500">
                {data.file_type}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-6">
            File Path
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-sm text-gray-500">File Path:</span>
              <p className="font-medium text-gray-900 mt-1">
                {data.name_with_path}
              </p>
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">Document Info</h3>
            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-semibold text-gray-700 mb-4">
                Latest Version Details
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">File Size</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {formatFileSize(data.size || 0)}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">Created Date</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {formatProcoreTime(data.created_at || "")}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Last Updated</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {formatProcoreTime(data.updated_at || "")}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Status</span>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium  ${data.is_deleted ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                      >
                        {data.is_deleted ? "Deleted" : "Active"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Download Document
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
