import Button from "@/components/ui/Button";
import procoreIcon from "@/assets/images/procore-icon.png";

type Props = {
  isToolView: boolean;
  isProcoreDrawingCodeQR: boolean;
  isTalihoFileTypeQR: boolean;
  isTalihoURLTypeQR: boolean;
  isProjectArchived?: boolean;
  bulkActions: boolean;
  onToggleBulk: () => void;
  onFetchProcore: () => void;
  onAddItems: () => void;
  onBallInCourt?: () => void;
};

export default function QrHeaderActions(props: Props) {
  const {
    isToolView,
    isProcoreDrawingCodeQR,
    isTalihoFileTypeQR,
    isTalihoURLTypeQR,
    isProjectArchived,
    bulkActions,
    onToggleBulk,
    onFetchProcore,
    onAddItems,
    onBallInCourt,
  } = props;
  const disabled =
    isToolView ||
    isProcoreDrawingCodeQR ||
    isTalihoFileTypeQR ||
    isTalihoURLTypeQR;
  const procoreDisabled = isProjectArchived;
  return (
    <div className="pb-4 flex items-center justify-between gap-2">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {onBallInCourt && (
          <Button
            type="button"
            variant="secondary"
            leftIcon={<img src={procoreIcon} alt="Procore" className="h-4 w-4" />}
            onClick={onBallInCourt}
          >
            Create Task Signoff
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          leftIcon={<img src={procoreIcon} alt="Procore" className="h-4 w-4" />}
          onClick={onFetchProcore}
          disabled={procoreDisabled}
          title={procoreDisabled ? "Project is archived" : undefined}
          className={procoreDisabled ? "opacity-50 cursor-not-allowed" : ""}
        >
          Fetch from Procore
        </Button>
       
        <Button
          type="button"
          variant="secondary"
          leftIconClass={`bx ${bulkActions ? "bx-x" : "bx-grid-alt"} text-gray-500`}
          disabled={disabled}
          onClick={onToggleBulk}
          className={disabled ? "opacity-50 active:scale-100" : ""}
        >
          {bulkActions ? "Cancel" : "Bulk Actions"}
        </Button>
        <Button
          type="button"
          variant="primary"
          leftIconClass="bx bx-plus"
          onClick={onAddItems}
          disabled={isProjectArchived}
          title={
            isProjectArchived ? "This project has been archived" : undefined
          }
        >
          Add Items
        </Button>

      </div>
    </div>
  );
}
