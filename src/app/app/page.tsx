import { Suspense } from "react";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Timeline } from "./timeline";
import { TimelineSkeleton } from "./timeline-skeleton";

export default function AppHomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mis torneos</h1>
        <div className="flex items-center gap-2">
          <Link href="/app/nuevo" className={buttonVariants({ variant: "default" })}>
            + Nuevo torneo
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>

      <Suspense fallback={<TimelineSkeleton />}>
        <Timeline />
      </Suspense>
    </main>
  );
}
