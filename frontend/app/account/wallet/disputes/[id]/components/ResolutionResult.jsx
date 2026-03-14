import { getResolutionLabel } from "./utils";

export default function ResolutionResult({ dispute }) {
  if (dispute.status !== "resolved") return null;

  return (
    <div className="rounded-lg border border-success/30 bg-success/10 p-4">
      <h3 className="font-semibold text-success mb-2">Dispute Resolved</h3>
      <p className="text-sm text-muted-foreground">
        Result:{" "}
        <strong className="text-foreground">{getResolutionLabel(dispute.resolution)}</strong>
      </p>
      {dispute.admin_notes && (
        <p className="mt-2 text-sm text-muted-foreground">Notes: {dispute.admin_notes}</p>
      )}
    </div>
  );
}
