/**
 * StorageDonutChart - Displays document vs QR storage breakdown as a donut chart
 * Uses recharts PieChart with inner radius for donut effect
 *
 * Fetches fresh data from /storage-stats endpoint to show accurate values
 * for legacy V2 data.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  PieLabelRenderProps,
} from "recharts";
import { useStorageStats } from "@/api/endpoints/company";
import { formatStorageAdaptive } from "../../utils/settingsFormatters";

function getCompanyIdFromLocalStorage(): string {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return "";
    const user = JSON.parse(userStr);
    return user?.companyId || "";
  } catch {
    return "";
  }
}

export interface StorageDonutChartProps {
  /** @deprecated - Now fetched from useStorageStats. Kept for backwards compatibility. */
  documentUsedBytes?: number;
  /** @deprecated - Now fetched from useStorageStats. Kept for backwards compatibility. */
  qrUsedBytes?: number;
  isFreeTrial: boolean;
}

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  [key: string]: unknown; // Index signature to satisfy Record<string, unknown>
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
  unit?: string;
}

const COLORS = {
  documents: "#2563eb", // blue
  qrCodes: "#fbbf24", // yellow
};

function CustomTooltip({ active, payload, unit = "GB" }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div
      className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200"
      data-testid="chart-tooltip"
    >
      <p className="text-sm font-medium text-gray-900">{data.name}</p>
      <p className="text-sm text-gray-600">
        {data.value.toFixed(2)} {unit}
      </p>
    </div>
  );
}

function renderCustomLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

  // Type guards for potentially undefined properties
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number" ||
    percent === 0
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
      data-testid="pie-label"
    >
      {/* {`${(percent * 100).toFixed(0)}%`} */}
    </text>
  );
}

export function StorageDonutChart({
  documentUsedBytes: propDocumentUsedBytes,
  qrUsedBytes: propQrUsedBytes,
}: StorageDonutChartProps) {
  const companyId = getCompanyIdFromLocalStorage();

  // Fetch fresh storage stats from backend (React Query will dedupe with StorageStats)
  const { data: freshStats } = useStorageStats(companyId);

  // Use fresh data if available, otherwise fall back to props
  const documentUsedBytes =
    freshStats?.documentStorageUsed ?? propDocumentUsedBytes ?? 0;
  const qrUsedBytes = freshStats?.qrCodeStorageUsed ?? propQrUsedBytes ?? 0;

  // Use adaptive formatting - shows MB for small values, GB for large
  const totalBytes = documentUsedBytes + qrUsedBytes;
  const formatted = formatStorageAdaptive(totalBytes);
  const unit = formatted.unit;

  // Convert individual values to the same unit for chart display
  const MB = 1_048_576;
  const GB = 1_073_741_824;
  const divisor = unit === "MB" ? MB : GB;

  const documentUsed = documentUsedBytes / divisor;
  const qrUsed = qrUsedBytes / divisor;

  const data: ChartDataItem[] = [
    { name: "Documents", value: documentUsed, color: COLORS.documents },
    { name: "QR Codes", value: qrUsed, color: COLORS.qrCodes },
  ];

  const total = documentUsed + qrUsed;

  // Handle case where both values are 0
  const hasData = total > 0;

  return (
    <div
      className="w-full max-w-[200px] h-[200px] sm:max-w-[200px] sm:h-[200px] max-sm:max-w-[160px] max-sm:h-[160px]"
      data-testid="storage-donut-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={
              hasData ? data : [{ name: "Empty", value: 1, color: "#e5e7eb" }]
            }
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
            animationDuration={800}
            label={hasData ? renderCustomLabel : undefined}
            labelLine={false}
          >
            {(hasData ? data : [{ color: "#e5e7eb" }]).map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                data-testid={`pie-cell-${index}`}
              />
            ))}
          </Pie>
          {hasData && <Tooltip content={<CustomTooltip unit={unit} />} />}
          {/* Center label showing total */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            data-testid="center-label"
          >
            <tspan
              x="50%"
              dy="-0.5em"
              className="text-lg font-semibold fill-gray-900"
              style={{ fontSize: "16px", fontWeight: 600 }}
            >
              {total.toFixed(1)}
            </tspan>
            <tspan
              x="50%"
              dy="1.4em"
              className="text-xs fill-gray-500"
              style={{ fontSize: "12px" }}
            >
              {unit}
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StorageDonutChart;
