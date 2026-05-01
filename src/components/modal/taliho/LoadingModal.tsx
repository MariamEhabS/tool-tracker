import Modal from "@/components/modal/Modal";

type LoadingModalProps = {
  open: boolean;
  message?: string;
};

export default function LoadingModal(props: LoadingModalProps) {
  const { open, message = "Creating QR code…" } = props;

  return (
    <Modal
      open={open}
      onClose={() => {}}
      size="sm"
      closeButton={false}
      overlayClosable={false}
    >
      <div className="flex items-center gap-4">
        <span className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-yellow-500 animate-spin" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{message}</span>
          <span className="text-xs text-gray-500">
            This will take just a moment.
          </span>
        </div>
      </div>
    </Modal>
  );
}
