"use client";

import Button from "@/components/ui/Button";
import useAdminBadges from "./useAdminBadges";
import BadgeList from "./components/BadgeList";
import BadgeForm from "./components/BadgeForm";

export default function AdminBadgesPage() {
  const {
    badges,
    loading,
    authError,
    showModal,
    setShowModal,
    editingBadge,
    formData,
    setFormData,
    error,
    saving,
    openCreateModal,
    openEditModal,
    handleSubmit,
    handleDelete,
  } = useAdminBadges();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-6 py-4 text-sm text-destructive">
          {authError}
        </div>
        <p className="text-muted-foreground">Mengalihkan ke halaman login...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Badge</h1>
          <p className="mt-1 text-muted-foreground">
            Kelola badge yang dapat diberikan kepada pengguna
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          + Buat Badge
        </Button>
      </div>

      <BadgeList
        badges={badges}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onCreateClick={openCreateModal}
      />

      <BadgeForm
        showModal={showModal}
        onClose={() => setShowModal(false)}
        editingBadge={editingBadge}
        formData={formData}
        setFormData={setFormData}
        error={error}
        saving={saving}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
