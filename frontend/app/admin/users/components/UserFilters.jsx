import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function UserFilters({ search, setSearch, onSearch }) {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengguna</h1>
        <p className="mt-1 text-muted-foreground">Cari pengguna dan kelola badge mereka</p>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <Input
          placeholder="Cari username atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary">
          Cari
        </Button>
      </form>
    </>
  );
}
