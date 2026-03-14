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
        <h2 className="text-2xl font-semibold border-b pb-2">Modal Component</h2>
        
        <div className="flex flex-wrap gap-4">
          <Button onClick={() => { setModalSize("sm"); setModalOpen(true); }}>
            Small Modal
          </Button>
          <Button onClick={() => { setModalSize("md"); setModalOpen(true); }}>
            Medium Modal
          </Button>
          <Button onClick={() => { setModalSize("lg"); setModalOpen(true); }}>
            Large Modal
          </Button>
          <Button onClick={() => { setModalSize("xl"); setModalOpen(true); }}>
            Extra Large Modal
          </Button>
          <Button onClick={() => { setModalSize("full"); setModalOpen(true); }}>
            Full Screen Modal
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`${modalSize.toUpperCase()} Modal Example`}
          size={modalSize}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This is a {modalSize} modal with focus trap and improved animations.
              Try pressing ESC or clicking outside to close.
            </p>
            <Input label="Test Input" placeholder="Focus is trapped here" />
            <Textarea label="Test Textarea" placeholder="Try tabbing through" />
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      </section>

      {/* Toast Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Toast Component</h2>
        
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => toast.success("Success!", "Operation completed successfully")}
          >
            Success Toast
          </Button>
          <Button
            onClick={() => toast.error("Error!", "Something went wrong")}
          >
            Error Toast
          </Button>
          <Button
            onClick={() => toast.warning("Warning!", "Please review this action")}
          >
            Warning Toast
          </Button>
          <Button
            onClick={() => toast.info("Info", "Here's some information")}
          >
            Info Toast
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "With Action",
                description: "Click the button below",
                variant: "info",
                action: { label: "Undo", onClick: () => alert("Undo clicked!") },
              })
            }
          >
            Toast with Action
          </Button>
          <Button
            onClick={() =>
              toast.promise(
                new Promise((resolve) => setTimeout(resolve, 2000)),
                {
                  loading: "Loading...",
                  success: "Success!",
                  error: "Error occurred",
                }
              )
            }
          >
            Promise Toast
          </Button>
        </div>
      </section>
    </>
  );
}
