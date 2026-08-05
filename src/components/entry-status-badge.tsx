import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ENTRY_STATUS_LABELS, type EntryStatus } from "@/lib/types";

const STATUS_STYLES: Record<EntryStatus, string> = {
  open: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  ballot: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  waitlist: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  invitation: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  sold_out: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
};

/** Color-coded badge for a race's entry status. */
export function EntryStatusBadge({
  status,
  className,
}: {
  status: EntryStatus;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(STATUS_STYLES[status], className)}>
      {ENTRY_STATUS_LABELS[status]}
    </Badge>
  );
}
