export function TriggerCard({
  name,
  id,
  description,
}: {
  name: string;
  id: string;
  description: string;
}) {
  return (
    <div className="trigger-card border border-rule bg-paper p-[1.35rem]">
      <div className="trigger-card-name font-display text-base font-bold uppercase tracking-[0.005em]">
        {name}
      </div>
      <div className="trigger-card-id mb-2.5 font-mono text-[0.65rem] tracking-[0.05em] text-red">
        {id}
      </div>
      <div className="trigger-card-desc text-[0.83rem] leading-normal text-inkMuted">
        {description}
      </div>
    </div>
  );
}
