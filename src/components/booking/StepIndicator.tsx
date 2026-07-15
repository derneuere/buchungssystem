// Fortschrittsanzeige des Wizards (SPEC §5.1: "Schritt X von Y", A11y via
// aria-live in der Elternkomponente; hier nur die visuelle Darstellung).

import { Progress } from '@/components/ui/progress'
import { useSprache } from '@/lib/sprache'

export function StepIndicator({
  step,
  total,
  titel,
}: {
  step: number
  total: number
  titel: string
}) {
  const { t } = useSprache()
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{t('wizard.stepIndicator', { step, total })}</span>
        <span className="truncate font-medium text-foreground">{titel}</span>
      </div>
      <Progress value={(step / total) * 100} className="h-2" />
    </div>
  )
}
