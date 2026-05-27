import { Skeleton } from '@/components/ui/skeleton'

export function WhatsAppSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-[18rem_1fr]">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}
