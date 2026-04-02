const pulseClass =
  "animate-pulse rounded-full bg-[rgba(23,37,47,0.08)]";

export default function WorkspaceLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,252,249,0.78)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className={`h-3 w-28 ${pulseClass}`} />
        <div className={`mt-4 h-8 w-64 ${pulseClass}`} />
        <div className={`mt-3 h-4 w-full max-w-xl ${pulseClass}`} />
        <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
          <div className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className={`h-4 w-32 ${pulseClass}`} />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="h-12 rounded-[18px] bg-[rgba(16,33,43,0.05)]"
                  key={index}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] p-4">
            <div className={`h-4 w-24 ${pulseClass}`} />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-10 rounded-[16px] bg-[rgba(16,33,43,0.05)]"
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,252,249,0.74)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`h-5 w-40 ${pulseClass}`} />
          <div className={`h-9 w-32 ${pulseClass}`} />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="rounded-[22px] border border-[var(--border)] bg-[rgba(248,250,252,0.82)] p-4"
              key={index}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className={`h-4 w-36 ${pulseClass}`} />
                  <div className={`h-3 w-full max-w-md ${pulseClass}`} />
                </div>
                <div className={`h-8 w-24 ${pulseClass}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] p-4 shadow-[var(--shadow-sm)]"
            key={index}
          >
            <div className={`h-4 w-24 ${pulseClass}`} />
            <div className={`mt-3 h-3 w-full max-w-[180px] ${pulseClass}`} />
          </div>
        ))}
      </section>
    </div>
  );
}
