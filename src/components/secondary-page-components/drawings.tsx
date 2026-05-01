import { formatProcoreTime } from "../../utils/dateFormatter";
import { ProcoreToolData, Project } from "../../types";

interface DrawingsPageProps {
  procoreData: ProcoreToolData;
  projectData: Project;
}

export const DrawingsPageComponent: React.FC<DrawingsPageProps> = ({
  procoreData,
  projectData,
}) => {
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold">{projectData.projectName}</h1>
        <p className="text-gray-600">{projectData.projectAddress}</p>
        <p className="text-gray-600">{`${projectData.projectCity}, ${projectData.projectState} ${projectData.projectZIP}`}</p>
      </div>

      <div className="flex justify-between text-blue-600">
        <a href="#" className="hover:underline">
          Back to Drawings
        </a>
        <a href="#" className="hover:underline">
          Back to Tools
        </a>
      </div>

      {procoreData.map((data, index) => (
        <div key={index} className="relative">
          <div className="relative bg-white rounded-lg shadow-lg overflow-hidden">
            <img
              src="https://placehold.co/600x400"
              alt="Architectural Drawing"
              className="w-full h-auto"
            />
            <div className="absolute top-2 right-2">
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                NEW!
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center px-4">
            <button className="p-2 hover:bg-gray-100 rounded-full"></button>
            <div className="flex gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full"></button>
              <button className="p-2 hover:bg-gray-100 rounded-full"></button>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full"></button>
          </div>

          <div className="text-2xl font-bold text-center">{data?.number}</div>
          <div className="text-xl text-center mb-6">{data.title}</div>

          <div className="p-4 bg-gray-100 space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Set:</span>
              <span>Bid Set</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Discipline:</span>
              <span>{data.discipline}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Drawing Date:</span>
              <span className="text-red-600">
                {formatProcoreTime(`${data?.current_revision?.updated_at}`)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Revision:</span>
              <span>{data?.current_revision?.revision_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Obsolete:</span>
              <span className="text-red-600">{`${!data.obsolete ? "No" : "Yes"}`}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
