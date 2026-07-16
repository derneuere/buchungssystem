import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_BADGE_CLASS, statusLabel } from '@/lib/admin-format'
import type { BuchungStatus } from '@/lib/types'

export function StatusBadge({ status, className }: { status: BuchungStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE_CLASS[status], className)}>
      {statusLabel(status)}
    </Badge>
  )
}
