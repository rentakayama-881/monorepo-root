import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function DemoModals({ modalOpen, setModalOpen, modalSize, setModalSize }) {
  const { toast } = useToast();

  return (
    <>
      {/* Modal Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Komponen Modal</h2>

        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => {
              setModalSize("sm");
              setModalOpen(true);
            }}
          >
            Modal Kecil
          </Button>
          <Button
            onClick={() => {
              setModalSize("md");
              setModalOpen(true);
            }}
          >
            Modal Sedang
          </Button>
          <Button
            onClick={() => {
              setModalSize("lg");
              setModalOpen(true);
            }}
          >
            Modal Besar
          </Button>
          <Button
            onClick={() => {
              setModalSize("xl");
              setModalOpen(true);
            }}
          >
            Modal Ekstra Besar
          </Button>
          <Button
            onClick={() => {
              setModalSize("full");
              setModalOpen(true);
            }}
          >
            Modal Layar Penuh
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Contoh Modal ${modalSize.toUpperCase()}`}
          size={modalSize}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ini adalah modal ukuran {modalSize} dengan focus trap dan animasi yang lebih baik.
              Coba tekan ESC atau klik area luar untuk menutup.
            </p>
            <Input label="Input Uji" placeholder="Fokus akan tetap berada di area ini" />
            <Textarea label="Textarea Uji" placeholder="Coba navigasi dengan tombol tab" />
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={() => setModalOpen(false)}>Simpan Perubahan</Button>
            </div>
          </div>
        </Modal>
      </section>

      {/* Toast Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Komponen Toast</h2>

        <div className="flex flex-wrap gap-4">
          <Button onClick={() => toast.success("Berhasil!", "Operasi selesai dengan sukses")}>
            Toast Sukses
          </Button>
          <Button onClick={() => toast.error("Gagal!", "Terjadi kesalahan")}>Toast Error</Button>
          <Button onClick={() => toast.warning("Peringatan!", "Tinjau kembali aksi ini")}>
            Toast Peringatan
          </Button>
          <Button onClick={() => toast.info("Info", "Berikut informasi singkat")}>
            Toast Info
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "Dengan Aksi",
                description: "Klik tombol di bawah",
                variant: "info",
                action: { label: "Urungkan", onClick: () => alert("Aksi dibatalkan") },
              })
            }
          >
            Toast dengan Aksi
          </Button>
          <Button
            onClick={() =>
              toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
                loading: "Memuat...",
                success: "Berhasil!",
                error: "Terjadi kesalahan",
              })
            }
          >
            Toast Promise
          </Button>
        </div>
      </section>
    </>
  );
}
