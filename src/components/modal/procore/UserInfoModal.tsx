import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CreatorInfo } from "@/utils/creatorInfo";

interface UserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (info: CreatorInfo) => void;
  initialName?: string;
  initialCompany?: string;
}

export function UserInfoModal({
  isOpen,
  onClose,
  onSave,
  initialName = "",
  initialCompany = "",
}: UserInfoModalProps) {
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || "");
      setCompany(initialCompany || "");
    }
  }, [isOpen, initialName, initialCompany]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="w-full sm:max-w-md mx-2 sm:mx-0 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl"
          >
            <div className="px-5 py-4 border-b border-gray-200 bg-yellow-400 rounded-t-2xl sm:rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Your Info</h2>
              <p className="text-sm text-gray-900/80">Tell us who you are</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || !company.trim()) return;
                onSave({ name: name.trim(), company: company.trim() });
                onClose();
              }}
              className="px-5 pt-4 pb-5 space-y-4"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Acme Builders"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500"
                >
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
