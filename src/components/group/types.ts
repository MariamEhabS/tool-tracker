export type QRItem = {
  id: string;
  title: string;
  type:
    | "File"
    | "Taliho"
    | "URL"
    | "Procore Tool"
    | "Procore Location"
    | "Procore Drawing";
  created: string;
  scans: number;
  image?: string;
  fallbackImage?: string;
  hasS3?: boolean;
  svgFallback?: string;
  passwordActivated?: boolean;
};
