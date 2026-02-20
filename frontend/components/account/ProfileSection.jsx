import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ProfileSection({
  form,
  setForm,
  socials,
  updateSocial,
  removeSocial,
  addSocial,
  profileDirty,
  profileSaving,
  profileSaveMessage,
  onSaveAccount,
}) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title mb-3">Profil</h3>
      <form onSubmit={onSaveAccount} className="mt-3 space-y-3">
        <Input
          label="Name"
          value={form.full_name}
          onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
        />
        <div>
          <label className="text-sm font-medium text-foreground">Bio</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Pronouns"
            value={form.pronouns}
            onChange={(e) => setForm((prev) => ({ ...prev, pronouns: e.target.value }))}
          />
          <Input
            label="Company"
            value={form.company}
            onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
          />
        </div>
        <Input
          label="Telegram (Private Consultation Contact)"
          placeholder="@username (tidak ditampilkan publik)"
          value={form.telegram}
          onChange={(e) => setForm((prev) => ({ ...prev, telegram: e.target.value }))}
        />
        <div>
          <label className="text-sm font-medium">Social Accounts</label>
          <div className="space-y-2 mt-2">
            {socials.map((social, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 items-start">
                <Input
                  placeholder="Label (Instagram, LinkedIn, Toko Shopee, dll)"
                  value={social.label || ""}
                  onChange={(e) => updateSocial(index, "label", e.target.value)}
                />
                <Input
                  placeholder="https://..."
                  value={social.url || ""}
                  onChange={(e) => updateSocial(index, "url", e.target.value)}
                />
                <div className="col-span-2 text-right">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeSocial(index)}
                    className="text-xs px-2 py-1"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addSocial} className="text-sm">
              + Tambah
            </Button>
          </div>
        </div>
        <div className="pt-2 space-y-2">
          <Button type="submit" size="sm" disabled={!profileDirty || profileSaving} loading={profileSaving}>
            Simpan Profil
          </Button>
          {profileSaveMessage && <Alert variant="success" message={profileSaveMessage} compact />}
        </div>
      </form>
    </section>
  );
}
