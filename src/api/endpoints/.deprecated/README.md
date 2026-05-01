# Deprecated Endpoint Modules

This folder contains deprecated API endpoint modules that are no longer actively used in the frontend application.

## Purpose

This folder serves as an archive for endpoint modules that have been superseded by newer implementations. Files are kept here for reference and to support legacy backend data model dependencies, but should not be used in new code.

## Why These Files Were Deprecated

The following modules were deprecated as part of the backend consolidation effort:

| File              | Deprecated Date | Reason                              |
| ----------------- | --------------- | ----------------------------------- |
| `arrangements.ts` | 2026-01-19      | Consolidated into the Groups module |
| `equipment.ts`    | 2026-01-19      | Consolidated into the Groups module |

## Important Notes

- **Do not import** these files in new frontend code
- Backend modules remain active for legacy data model references only
- For new functionality, use the consolidated `groups.ts` endpoint module
- These files are preserved to maintain git history and provide reference for legacy implementations

## Contact

If you have questions about these deprecated modules or need guidance on migration, consult the Groups module documentation or contact the backend team.
