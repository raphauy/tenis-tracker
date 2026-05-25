import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function AppHomePage() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Mi carrera</h1>
        <p className="text-muted-foreground">Próximamente: tu línea de tiempo de torneos.</p>
        {session?.user?.email && (
          <p className="text-sm text-muted-foreground">
            Sesión: {session.user.email}
          </p>
        )}
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="outline">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
