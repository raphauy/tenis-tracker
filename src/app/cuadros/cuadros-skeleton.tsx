import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CuadrosIndexSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Card className="flex-row items-center justify-between gap-3 px-4 py-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-24" />
          </Card>
        </li>
      ))}
    </ul>
  )
}
