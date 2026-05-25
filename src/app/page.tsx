import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4 max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Tenis Tracker
        </h1>
        <p className="text-lg text-muted-foreground">
          Llevá el registro de tu carrera tenística: torneos, partidos, rivales
          y resultados, con estadísticas de tu progreso.
        </p>
      </div>
      <Button size="lg" nativeButton={false} render={<Link href="/login" />}>
        Entrar
      </Button>
    </main>
  );
}
