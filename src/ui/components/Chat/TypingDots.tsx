/** Three-dot "still working" tell, shown between send and the first token. */
export const TypingDots = ({ label = "Thinking" }: { label?: string }) => (
  <div
    className="flex items-center gap-1.5 py-0.5"
    role="status"
    aria-label={`${label}…`}
  >
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        aria-hidden
        className="h-1.5 w-1.5 animate-gm-typing rounded-full bg-neutral-400"
        style={{ animationDelay: `${index * 160}ms` }}
      />
    ))}
  </div>
);
