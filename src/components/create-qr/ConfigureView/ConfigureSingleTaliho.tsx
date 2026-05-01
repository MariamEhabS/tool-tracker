import type { SearchComboBoxValue } from "@/components/combobox/detail/SearchComboBox";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import Button from "@/components/ui/Button";
import type { RefObject } from "react";

export interface ConfigureSingleTalihoProps {
  categoryValue: SearchComboBoxValue | SearchComboBoxValue[] | undefined;
  setCategoryValue: (
    v: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => void;
  talihoQuery: string;
  setTalihoQuery: (q: string) => void;
  descriptionRef: RefObject<HTMLTextAreaElement | null>;
  isLoadingCategories: boolean;
  isCategoriesFetched: boolean;
  categoryGroups: Array<{
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  handleCategoriesDropdownOpen: () => void;
  isFieldInvalid: (field: string) => boolean;
  inputErrorClass: (field: string) => string;
  renderValidationError: (field: string) => React.ReactNode;
  clearValidationError: (field: string) => void;
  onCreateAddAnother: () => void;
  onCreateNow: () => void;
  configureKey: string | null;
}

export default function ConfigureSingleTaliho({
  categoryValue,
  setCategoryValue,
  talihoQuery,
  setTalihoQuery,
  descriptionRef,
  isLoadingCategories,
  isCategoriesFetched,
  categoryGroups,
  handleCategoriesDropdownOpen,
  isFieldInvalid,
  inputErrorClass,
  renderValidationError,
  clearValidationError,
  onCreateAddAnother,
  onCreateNow,
  configureKey,
}: ConfigureSingleTalihoProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name{" "}
          {isFieldInvalid("name") ? (
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {isLoadingCategories || !isCategoriesFetched ? (
          <div className="flex items-center gap-2 h-[38px] px-3 border border-gray-300 rounded-md bg-gray-50">
            <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin"></span>
            <span className="text-sm text-gray-500">Loading categories...</span>
          </div>
        ) : categoryGroups.length > 0 ? (
          <SearchComboBox
            groups={categoryGroups}
            value={categoryValue}
            onChange={(next) => {
              setCategoryValue(next);
              clearValidationError("name");
            }}
            placeholder="Enter name or search..."
            inputClassName={`text-sm ${inputErrorClass("name")}`}
            loading={isLoadingCategories}
            onOpen={handleCategoriesDropdownOpen}
            onQueryChange={(q) => setTalihoQuery(q)}
            hideNoResults
            usePortal
          />
        ) : (
          <input
            type="text"
            value={talihoQuery}
            onChange={(e) => {
              setTalihoQuery(e.target.value);
              clearValidationError("name");
            }}
            placeholder="Enter name..."
            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-400 focus:ring-brand-400 text-sm ${inputErrorClass("name")}`}
          />
        )}
        {renderValidationError("name")}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          ref={descriptionRef}
          className="block resize-none w-full rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500"
          rows={3}
          maxLength={180}
          placeholder="Add a short description (optional)"
        ></textarea>
      </div>
      {configureKey ? (
        <div className="flex items-center gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onCreateAddAnother}
          >
            Create & Add Another
          </Button>
          <Button type="button" variant="primary" onClick={onCreateNow}>
            Create & Populate
          </Button>
        </div>
      ) : null}
    </div>
  );
}
