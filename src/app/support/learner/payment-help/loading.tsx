export default function PaymentHelpLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-white">
      <div className="h-20 bg-black" />
      <section className="bg-black px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="h-9 w-44 bg-zinc-800" />
          <div className="mt-5 h-14 max-w-xl bg-zinc-800" />
          <div className="mt-5 h-7 max-w-3xl bg-zinc-800" />
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-3 px-4 py-12 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-44 bg-zinc-100" />)}
      </section>
    </main>
  );
}

