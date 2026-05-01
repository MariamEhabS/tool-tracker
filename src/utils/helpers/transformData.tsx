/**
 * @fileoverview Transforms raw QR code data (folders, documents, Procore tools)
 * into a uniform row format for table display.
 */

interface Folder {
  _id: string;
  folderName: string;
  linkedFiles: { documentSize: number; createdAt: string }[];
}

interface Document {
  _id: string;
  documentName: string;
  documentSize: number;
  createdAt: string;
}

interface ProcoreTool {
  tool: string;
  count: number | null;
}

/**
 * Transforms QR code data (folders, documents, or Procore tools) into a
 * normalized row format used by the data table.
 *
 * @param data - Raw QR code data containing folders, documents, and procoreTools arrays
 * @param viewType - Which data type to transform ("folders" | "documents" | "procoreTools"),
 *                   or any other value to combine all three.
 * @returns Array of normalized row objects with consistent id, name, type, etc.
 */
export const transformDataForView = (
  data: {
    folders: Folder[];
    documents: Document[];
    procoreTools: ProcoreTool[];
  },
  viewType: string,
): Array<{
  id: string;
  key: string;
  tool: string;
  name: string;
  type: string;
  filesCount: number;
  size: number;
  lastModified: string;
  category: string;
}> => {
  switch (viewType) {
    case "folders":
      return data?.folders?.map((folder) => ({
        id: folder._id,
        key: folder._id,
        name: folder.folderName,
        type: "Folder",
        filesCount: folder.linkedFiles.length,
        size: folder.linkedFiles.reduce(
          (acc, file) => acc + file.documentSize,
          0,
        ),
        lastModified:
          folder.linkedFiles.length > 0
            ? new Date(
                Math.max(
                  ...folder.linkedFiles.map((f) =>
                    new Date(f.createdAt).getTime(),
                  ),
                ),
              ).toLocaleDateString()
            : "N/A",
        category: "taliho-local",
        tool: "folder",
      }));

    case "documents":
      return data?.documents?.map((doc) => ({
        id: doc._id,
        key: doc._id,
        name: doc.documentName,
        type: "Document",
        filesCount: 1,
        size: doc.documentSize,
        lastModified: new Date(doc.createdAt).toLocaleDateString(),
        category: "taliho-local",
        tool: "document",
      }));

    case "procoreTools":
      return (
        data?.procoreTools?.map((tool, index) => {
          // Safety check for undefined tool.tool
          const toolName = tool?.tool || "unknown";
          // Format the tool name for display: "punch-list" -> "Punch List"
          const formattedName = toolName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          return {
            id: `tool-${index}`,
            key: `${index}`,
            name: formattedName,
            type: "Procore Tool",
            filesCount: tool?.count || 0,
            size: 0,
            lastModified: "N/A",
            category: "procore",
            tool: toolName,
          };
        }) || []
      );

    default:
  }
  const folders = transformDataForView(data, "folders");
  const documents = transformDataForView(data, "documents");
  const tools = transformDataForView(data, "procoreTools");
  return [...(folders || []), ...(documents || []), ...(tools || [])];
};

/**
 * Formats a byte count into a human-readable file size string (e.g., "1.5 MB").
 * @param bytes - The number of bytes to format
 */
export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
