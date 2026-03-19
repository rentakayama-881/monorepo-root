import Select from "@/components/ui/Select";

const sampleOptions = [
  { value: "react", label: "React", group: "Frontend" },
  { value: "vue", label: "Vue", group: "Frontend" },
  { value: "angular", label: "Angular", group: "Frontend" },
  { value: "node", label: "Node.js", group: "Backend" },
  { value: "python", label: "Python", group: "Backend" },
  { value: "go", label: "Go", group: "Backend" },
];

export default function DemoSelects({
  selectValue,
  setSelectValue,
  multiSelectValue,
  setMultiSelectValue,
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold border-b pb-2">Komponen Select</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Select Dasar</h3>
          <Select
            label="Framework"
            placeholder="Pilih framework"
            options={sampleOptions}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          />
        </div>

        {/* Searchable Select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Dengan Pencarian</h3>
          <Select
            label="Teknologi"
            placeholder="Cari teknologi..."
            options={sampleOptions}
            searchable
          />
        </div>

        {/* Multi-select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Multi-select</h3>
          <Select
            label="Keahlian"
            placeholder="Pilih beberapa keahlian"
            options={sampleOptions}
            multiSelect
            searchable
            value={multiSelectValue}
            onChange={(e) => setMultiSelectValue(e.target.value)}
          />
        </div>

        {/* With Groups */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Dengan Grup Opsi</h3>
          <Select
            label="Tech Stack"
            placeholder="Pilih dari grup"
            options={sampleOptions}
            searchable
          />
        </div>

        {/* Loading State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">State Memuat</h3>
          <Select label="Memuat..." placeholder="Mengambil opsi..." options={[]} loading />
        </div>

        {/* Empty State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">State Kosong</h3>
          <Select
            label="Tidak Ada Opsi"
            placeholder="Tidak ada opsi tersedia"
            options={[]}
            emptyMessage="Tidak ada teknologi ditemukan"
          />
        </div>
      </div>
    </section>
  );
}
