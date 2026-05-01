import Breadcrumbs from "@/components/ui/Breadcrumbs";

type Props = {
  items: Array<{ label: string }>;
  onCrumbClick: (index: number) => void;
};

export default function QrBreadcrumbs({ items, onCrumbClick }: Props) {
  return (
    <div className="px-0 pb-3">
      <Breadcrumbs variant="folder" items={items} onCrumbClick={onCrumbClick} />
    </div>
  );
}
