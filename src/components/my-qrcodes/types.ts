import type { RowType } from "@/components/ui/Icon";

export type QrCodesListResponse = {
  data?: Array<{ _id: string; project?: string; bucket?: string }>;
  total_items?: number;
  has_next?: boolean;
  has_prev?: boolean;
};

export type Row = {
  id: string;
  name: string;
  type: RowType;
  group: string;
  groupId?: string;
  groupType: "arrangement" | "equipment" | "none";
  groupArrangementType?: string;
  project: string;
  projectId?: string;
  createdAt: string;
  scans: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};
