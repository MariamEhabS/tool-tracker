/**
 * StorageTrendChart - Displays 30-day storage usage history as a line chart
 * Shows total, document, and QR storage trends over time
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  CartesianGrid,
} from "recharts";
import {
  useStorageHistory,
  StorageHistoryPoint,
} from "../../hooks/useStorageHistory";

export interface StorageTrendChartProps {
  companyId: string;
  days?: number;
  isFreeTrial?: boolean;
}

interface ChartDataPoint {
  date: string;
  formattedDate: string;
  total: number;
  document: number;
  qr: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
  unit?: string;
}

const BYTES_PER_GB = 1_073_741_824; // 1024^3 (binary, consistent with donut chart and stat cards)
const BYTES_PER_MB = 1_048_576;

const LINE_COLORS = {
  total: "#6b7280", // gray-500
  document: "#2563eb", // blue-600
  qr: "#fbbf24", // yellow-500
};

/**
 * Converts bytes to gigabytes
 */
// eslint-disable-next-line react-refresh/only-export-components
export function bytesToGB(bytes: number): number {
  return bytes / BYTES_PER_GB;
}

/**
 * Converts bytes to megabytes
 */
// eslint-disable-next-line react-refresh/only-export-components
export function bytesToMB(bytes: number): number {
  return bytes / BYTES_PER_MB;
}

/**
 * Formats a date string (YYYY-MM-DD) to display format (Jan 1)
 * Uses UTC to avoid timezone offset issues
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a date string (YYYY-MM-DD) to full format (Jan 1, 2026)
 * Uses UTC to avoid timezone offset issues
 */
// eslint-disable-next-line react-refresh/only-export-components
export function formatDateFull(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Transforms raw storage history data into chart-ready format
 */
function transformData(
  data: StorageHistoryPoint[],
  isFreeTrial: boolean,
): ChartDataPoint[] {
  const converter = isFreeTrial ? bytesToMB : bytesToGB;
  return data.map((point) => ({
    date: point.date,
    formattedDate: formatDateShort(point.date),
    total: converter(point.totalUsed),
    document: converter(point.documentUsed),
    qr: converter(point.qrUsed),
  }));
}

function CustomTooltip({
  active,
  payload,
  label,
  unit = "GB",
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !label) return null;

  const fullDate = formatDateFull(label);

  // Filter to only show Line entries (which have proper names like "Total", "Documents", "QR Codes")
  // This excludes Area entries which show raw dataKey names (total, document, qr)
  const validNames = ["Total", "Documents", "QR Codes"];
  const filteredPayload = payload.filter((entry) =>
    validNames.includes(entry.name),
  );

  return (
    <div
      className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200"
      data-testid="chart-tooltip"
    >
      <p className="text-sm font-medium text-gray-900 mb-1">{fullDate}</p>
      {filteredPayload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value.toFixed(2)} {unit}
        </p>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="w-full h-[250px] max-sm:h-[200px] animate-pulse"
      data-testid="storage-trend-chart-loading"
    >
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="w-full h-[250px] max-sm:h-[200px] flex items-center justify-center"
      data-testid="storage-trend-chart-error"
    >
      <div className="text-center">
        <i className="bx bx-error-circle text-3xl text-red-500 mb-2" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export function StorageTrendChart({
  companyId,
  days = 30,
  isFreeTrial = false,
}: StorageTrendChartProps) {
  const { data, isLoading, isError, error } = useStorageHistory(
    companyId,
    days,
  );
  const unit = isFreeTrial ? "MB" : "GB";

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error?.message || "Failed to load storage history"}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full h-[250px] max-sm:h-[200px] flex items-center justify-center"
        data-testid="storage-trend-chart-empty"
      >
        <p className="text-sm text-gray-500">No storage history available</p>
      </div>
    );
  }

  const chartData = transformData(data, isFreeTrial);

  // Calculate interval for X-axis to show ~7 labels
  const tickInterval = Math.max(1, Math.floor(chartData.length / 7));

  return (
    <div
      className="w-full h-[250px] max-sm:h-[200px]"
      data-testid="storage-trend-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={LINE_COLORS.total}
                stopOpacity={0.1}
              />
              <stop
                offset="95%"
                stopColor={LINE_COLORS.total}
                stopOpacity={0}
              />
            </linearGradient>
            <linearGradient id="documentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={LINE_COLORS.document}
                stopOpacity={0.15}
              />
              <stop
                offset="95%"
                stopColor={LINE_COLORS.document}
                stopOpacity={0}
              />
            </linearGradient>
            <linearGradient id="qrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LINE_COLORS.qr} stopOpacity={0.15} />
              <stop offset="95%" stopColor={LINE_COLORS.qr} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={{ stroke: "#d1d5db" }}
            tickLine={{ stroke: "#d1d5db" }}
            interval={tickInterval}
          />

          <YAxis
            tickFormatter={(value: number) => `${value.toFixed(0)} ${unit}`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={{ stroke: "#d1d5db" }}
            tickLine={{ stroke: "#d1d5db" }}
            width={60}
          />

          <Tooltip content={<CustomTooltip unit={unit} />} />

          {/* Area fills under lines */}
          <Area
            type="monotone"
            dataKey="total"
            stroke="none"
            fill="url(#totalGradient)"
          />
          <Area
            type="monotone"
            dataKey="document"
            stroke="none"
            fill="url(#documentGradient)"
          />
          <Area
            type="monotone"
            dataKey="qr"
            stroke="none"
            fill="url(#qrGradient)"
          />

          {/* Lines */}
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke={LINE_COLORS.total}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "white" }}
          />
          <Line
            type="monotone"
            dataKey="document"
            name="Documents"
            stroke={LINE_COLORS.document}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "white" }}
          />
          <Line
            type="monotone"
            dataKey="qr"
            name="QR Codes"
            stroke={LINE_COLORS.qr}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "white" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StorageTrendChart;
