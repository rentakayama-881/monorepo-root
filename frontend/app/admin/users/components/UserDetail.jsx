import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";

export default function UserDetail({
  showAssignModal,
  onClose,
  selectedUser,
  badges,
  assignData,
  setAssignData,
  assigning,
  assignError,
  onAssign,
}) {
  return (
    <Modal
      open={showAssignModal}
      onClose={onClose}
      title={`Berikan Badge ke ${selectedUser?.username || selectedUser?.email || "Pengguna"}`}
    >
      <form onSubmit={onAssign} className="space-y-4">
        {assignError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {assignError}
          </div>
        )}

        <Select
          label="Pilih Badge"
          placeholder="-- Pilih Badge --"
          options={badges.map((badge) => ({
            value: String(badge.id),
            label: badge.name,
          }))}
          value={assignData.badge_id}
          onChange={(e) => setAssignData({ ...assignData, badge_id: e.target.value })}
          required
        />

        <Input
          label="Alasan (opsional)"
          placeholder="Kontribusi luar biasa..."
          value={assignData.reason}
          onChange={(e) => setAssignData({ ...assignData, reason: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={assigning}>
            {assigning ? "Memberikan..." : "Berikan Badge"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
