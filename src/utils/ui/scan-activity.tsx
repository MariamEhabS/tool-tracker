/**
 * @fileoverview Scan activity summary card displaying a bar chart of
 * scan counts over the last 30 days.
 */

interface ScanActivityProps {
  scanCount?: number;
}

/**
 * Displays total scan count and a fixed 30-day bar chart visualization.
 * @param scanCount - Total number of scans to display
 */
export const ScanActivity: React.FC<ScanActivityProps> = ({ scanCount }) => {
  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Total Scans
          </h3>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {scanCount || 0}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Scan Activity (Last 30 Days)
          </p>
        </div>
        <div className="h-20 bg-gray-50 rounded flex items-end justify-between px-1 py-1 border border-gray-200">
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "15%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "35%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "25%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "45%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "55%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "20%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "50%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "75%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "30%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "60%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "90%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "100%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "80%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "60%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "40%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "70%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "85%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "75%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "55%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "65%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "40%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "20%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "30%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "10%" }}
          ></div>
          <div
            className="w-3 bg-green-500 rounded-t"
            style={{ height: "25%" }}
          ></div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
        <span>30 Days Ago</span>
        <span>Today</span>
      </div>
    </>
  );
};
