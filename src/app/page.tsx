import HomeActions from "@/components/home/HomeActions";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <section className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-black mb-3">🏆 Draftazo</h1>

        <p className="text-zinc-400 mb-8">
          Arma tu equipo, tira el roll y gana la gloria.
        </p>

        <HomeActions />
      </section>
    </main>
  );
}
