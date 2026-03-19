import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

export default function DemoCompleteForm() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold border-b pb-2">Contoh Form Lengkap</h2>

      <form className="max-w-2xl space-y-6 p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold">Buat Validation Case Baru</h3>

        <Input
          label="Judul"
          placeholder="Masukkan judul case"
          required
          maxLength={100}
          showCounter
          size="lg"
        />

        <Textarea
          label="Konten"
          placeholder="Tulis catatan case, ruang lingkup, bukti, dan kriteria penerimaan..."
          required
          autoResize
          minRows={5}
          maxRows={15}
          maxLength={5000}
          showCounter
          hint="Markdown didukung"
        />

        <Select
          label="Kategori"
          placeholder="Pilih kategori"
          required
          options={[
            { value: "academic", label: "Validasi Akademik" },
            { value: "legal", label: "Tinjauan Hukum" },
            { value: "financial", label: "Tinjauan Keuangan" },
            { value: "technical", label: "Tinjauan Teknis" },
          ]}
        />

        <Select
          label="Tag"
          placeholder="Pilih tag"
          multiSelect
          searchable
          options={[
            { value: "javascript", label: "JavaScript" },
            { value: "react", label: "React" },
            { value: "nodejs", label: "Node.js" },
            { value: "typescript", label: "TypeScript" },
            { value: "css", label: "CSS" },
          ]}
          hint="Anda dapat memilih beberapa tag"
        />

        <div className="flex gap-3 pt-4">
          <Button type="submit" variant="default">
            Buat Case Validasi
          </Button>
          <Button type="button" variant="ghost">
            Simpan Draft
          </Button>
        </div>
      </form>
    </section>
  );
}
