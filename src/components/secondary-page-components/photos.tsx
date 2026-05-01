import { ProcoreToolData, Project } from "../../types";

interface PhotosPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
}

export const PhotosPageComponent = ({
  procoreData,
  projectData,
}: PhotosPageComponentProps) => {
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
            {`${projectData.projectCity},  ${projectData.projectState} ${projectData.projectZIP}`}
          </p>
        </div>
      </div>
      {procoreData.map((data, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900">
                  #{data.issue_number}
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {data.title}
                </h2>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
