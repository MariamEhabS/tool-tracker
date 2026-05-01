/**
 * Tests for mock data fixtures
 * Validates that mock data objects have correct structure
 */

import { describe, it, expect } from "vitest";
import {
  mockQRCode,
  mockProcoreQRCode,
  mockPasswordProtectedQRCode,
  mockQRCodeList,
  mockArrangement,
  mockEquipment,
  mockArrangementList,
  mockProject,
  mockProcoreProject,
  mockArchivedProject,
  mockProjectList,
  mockUserState,
  mockStandardUser,
  mockPMUser,
  mockCompany,
  mockFreeTrialCompany,
  mockProcoreCompany,
  mockDocument,
  mockDocumentList,
  mockProcoreItem,
  mockProcoreRFI,
  mockProcoreSubmittal,
  mockProcorePunchItem,
  mockProcoreInspection,
  mockProcoreDrawing,
  mockProcoreItemList,
  mockColumns,
  mockTableRows,
  mockLargeTableRows,
  mockAppState,
  mockFolderStructure,
  mockProcoreState,
} from "./mock-data";

describe("mock-data fixtures", () => {
  describe("QR Code mocks", () => {
    it("has valid mockQRCode", () => {
      expect(mockQRCode._id).toBe("qr-test-001");
      expect(mockQRCode.qrcodeName).toBeDefined();
      expect(mockQRCode.company).toBeDefined();
      expect(mockQRCode.createdAt).toBeInstanceOf(Date);
    });

    it("has valid mockProcoreQRCode with Procore fields", () => {
      expect(mockProcoreQRCode.procoreConnect).toBe(true);
      expect(mockProcoreQRCode.procoreFetch).toBe(true);
      expect(mockProcoreQRCode.procoreCategory).toBe("drawings");
    });

    it("has valid mockPasswordProtectedQRCode", () => {
      expect(mockPasswordProtectedQRCode.passwordActivated).toBe(true);
      expect(mockPasswordProtectedQRCode.weekdayPassword).toBe(true);
      expect(mockPasswordProtectedQRCode.timezone).toBeDefined();
    });

    it("has valid mockQRCodeList with multiple items", () => {
      expect(mockQRCodeList.length).toBeGreaterThanOrEqual(3);
      mockQRCodeList.forEach((qr) => {
        expect(qr._id).toBeDefined();
        expect(qr.qrcodeName).toBeDefined();
      });
    });
  });

  describe("Group mocks", () => {
    it("has valid mockArrangement", () => {
      expect(mockArrangement._id).toBe("arr-test-001");
      expect(mockArrangement.arrangementName).toBeDefined();
      expect(mockArrangement.categories).toBeInstanceOf(Array);
    });

    it("has valid mockEquipment", () => {
      expect(mockEquipment._id).toBe("equip-test-001");
      expect(mockEquipment.equipmentName).toBeDefined();
      expect(mockEquipment.equipmentID).toBeDefined();
    });

    it("has valid mockArrangementList", () => {
      expect(mockArrangementList.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Project mocks", () => {
    it("has valid mockProject", () => {
      expect(mockProject._id).toBe("proj-test-001");
      expect(mockProject.projectName).toBeDefined();
      expect(mockProject.projectStatus).toBe("active");
    });

    it("has valid mockProcoreProject with Procore IDs", () => {
      expect(mockProcoreProject.procoreCompanyID).toBeDefined();
      expect(mockProcoreProject.procoreProjectID).toBeDefined();
    });

    it("has valid mockArchivedProject", () => {
      expect(mockArchivedProject.archived).toBe(true);
      expect(mockArchivedProject.projectStatus).toBe("archived");
    });

    it("has valid mockProjectList", () => {
      expect(mockProjectList.length).toBeGreaterThanOrEqual(3);
      const statuses = mockProjectList.map((p) => p.projectStatus);
      expect(statuses).toContain("active");
    });
  });

  describe("User mocks", () => {
    it("has valid mockUserState", () => {
      expect(mockUserState.firstName).toBe("Test");
      expect(mockUserState.permission).toBe("admin");
      expect(mockUserState.email).toBeDefined();
    });

    it("has valid mockStandardUser with user permission", () => {
      expect(mockStandardUser.permission).toBe("user");
    });

    it("has valid mockPMUser with pm permission", () => {
      expect(mockPMUser.permission).toBe("pm");
    });
  });

  describe("Company mocks", () => {
    it("has valid mockCompany", () => {
      expect(mockCompany._id).toBe("company-test-001");
      expect(mockCompany.companyName).toBeDefined();
      expect(mockCompany.paidAccount).toBe(true);
      expect(mockCompany.freeTrialActive).toBe(false);
    });

    it("has valid mockFreeTrialCompany", () => {
      expect(mockFreeTrialCompany.freeTrialActive).toBe(true);
      expect(mockFreeTrialCompany.paidAccount).toBe(false);
    });

    it("has valid mockProcoreCompany", () => {
      expect(mockProcoreCompany.procoreIntegration).toBe(true);
      expect(mockProcoreCompany.editProcoreItemsAllowed).toBe(true);
      expect(mockProcoreCompany.procoreCompanyID).toBeGreaterThan(0);
    });
  });

  describe("Document mocks", () => {
    it("has valid mockDocument", () => {
      expect(mockDocument._id).toBe("doc-test-001");
      expect(mockDocument.documentName).toBeDefined();
      expect(mockDocument.documentSize).toBeGreaterThan(0);
    });

    it("has valid mockDocumentList", () => {
      expect(mockDocumentList.length).toBeGreaterThanOrEqual(2);
      mockDocumentList.forEach((doc) => {
        expect(doc._id).toBeDefined();
        expect(doc.documentName).toBeDefined();
      });
    });
  });

  describe("Procore item mocks", () => {
    it("has valid mockProcoreItem", () => {
      expect(mockProcoreItem.id).toBeDefined();
      expect(mockProcoreItem.title).toBeDefined();
      expect(mockProcoreItem.status).toBeDefined();
    });

    it("has valid mockProcoreRFI with RFI-specific fields", () => {
      expect(mockProcoreRFI.full_number).toBeDefined();
      expect(mockProcoreRFI.rfi_manager).toBeDefined();
    });

    it("has valid mockProcoreSubmittal with submittal-specific fields", () => {
      expect(mockProcoreSubmittal.formatted_number).toBeDefined();
      expect(mockProcoreSubmittal.submittal_manager).toBeDefined();
    });

    it("has valid mockProcorePunchItem with punch-specific fields", () => {
      expect(mockProcorePunchItem.priority).toBeDefined();
      expect(mockProcorePunchItem.punch_item_manager).toBeDefined();
    });

    it("has valid mockProcoreInspection with inspection-specific fields", () => {
      expect(mockProcoreInspection.inspection_date).toBeDefined();
      expect(mockProcoreInspection.inspection_type).toBeDefined();
      expect(mockProcoreInspection.item_count).toBeDefined();
    });

    it("has valid mockProcoreDrawing with drawing-specific fields", () => {
      expect(mockProcoreDrawing.discipline).toBeDefined();
      expect(mockProcoreDrawing.revision).toBeDefined();
      expect(mockProcoreDrawing.current_revision).toBeDefined();
    });

    it("has valid mockProcoreItemList with various item types", () => {
      expect(mockProcoreItemList.length).toBe(5);
    });
  });

  describe("DataTable mocks", () => {
    it("has valid mockColumns", () => {
      expect(mockColumns.length).toBeGreaterThanOrEqual(3);
      mockColumns.forEach((col) => {
        expect(col.id).toBeDefined();
        expect(col.header).toBeDefined();
        expect(col.accessorKey).toBeDefined();
      });
    });

    it("has valid mockTableRows", () => {
      expect(mockTableRows.length).toBeGreaterThanOrEqual(3);
      mockTableRows.forEach((row) => {
        expect(row.id).toBeDefined();
        expect(row.name).toBeDefined();
        expect(row.status).toBeDefined();
      });
    });

    it("has valid mockLargeTableRows for pagination tests", () => {
      expect(mockLargeTableRows.length).toBe(100);
    });
  });

  describe("App state mocks", () => {
    it("has valid mockAppState", () => {
      expect(mockAppState.authenticated).toBe(true);
      expect(mockAppState).toHaveProperty("selectedTool");
    });
  });

  describe("Folder structure mocks", () => {
    it("has valid mockFolderStructure", () => {
      expect(mockFolderStructure.folders).toBeInstanceOf(Array);
      expect(mockFolderStructure.files).toBeInstanceOf(Array);
      expect(mockFolderStructure.folders.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Procore state mock", () => {
    it("has all Procore tool keys", () => {
      const expectedTools = [
        "documents",
        "drawings",
        "forms",
        "inspections",
        "punch-lists",
        "rfis",
        "submittals",
        "coordination-issues",
        "observations",
        "photos",
        "incidents",
        "instructions",
        "tasks",
        "directory",
        "specifications",
      ];

      expectedTools.forEach((tool) => {
        expect(mockProcoreState).toHaveProperty(tool);
        expect(
          Array.isArray(
            mockProcoreState[tool as keyof typeof mockProcoreState],
          ),
        ).toBe(true);
      });
    });
  });
});
