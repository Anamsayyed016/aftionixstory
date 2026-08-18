export function SpinCube({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div className="pf-cube">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
