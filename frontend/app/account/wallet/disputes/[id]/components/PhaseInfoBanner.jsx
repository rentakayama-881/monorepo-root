import { getPhaseInfo, formatDate } from "./utils";

export default function PhaseInfoBanner({ phase, phaseDeadline, isOpen }) {
  if (!isOpen) return null;

  const phaseInfo = getPhaseInfo(phase);

  return (
    <div className={`rounded-lg p-4 ${phaseInfo.containerClass}`}>
      <div className={`font-medium mb-1 ${phaseInfo.titleClass}`}>{phaseInfo.title}</div>
      <div className="text-sm text-muted-foreground">{phaseInfo.description}</div>
      {phaseDeadline && (
        <div className="mt-2 text-xs text-muted-foreground">
          Deadline: {formatDate(phaseDeadline)}
        </div>
      )}
    </div>
  );
}
