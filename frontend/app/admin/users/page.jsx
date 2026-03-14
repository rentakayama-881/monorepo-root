"use client";

import useAdminUsers from "./useAdminUsers";
import UserFilters from "./components/UserFilters";
import UserListTable from "./components/UserListTable";
import UserDetail from "./components/UserDetail";

export default function AdminUsersPage() {
  const {
    users,
    badges,
    loading,
    authError,
    search,
    setSearch,
    hasMore,
    showAssignModal,
    setShowAssignModal,
    selectedUser,
    assignData,
    setAssignData,
    assigning,
    assignError,
    handleSearch,
    loadMore,
    openAssignModal,
    handleAssign,
    handleRevoke,
  } = useAdminUsers();

  if (loading && users.length === 0) {
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
      <UserFilters search={search} setSearch={setSearch} onSearch={handleSearch} />

      <UserListTable
        users={users}
        search={search}
        loading={loading}
        hasMore={hasMore}
        onAssign={openAssignModal}
        onRevoke={handleRevoke}
        onLoadMore={loadMore}
      />

      <UserDetail
        showAssignModal={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        selectedUser={selectedUser}
        badges={badges}
        assignData={assignData}
        setAssignData={setAssignData}
        assigning={assigning}
        assignError={assignError}
        onAssign={handleAssign}
      />
    </div>
  );
}
