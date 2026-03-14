import FormLabel from "@/components/ui/FormLabel";
import Alert from "@/components/ui/Alert";

export default function DemoFormElements() {
  return (
    <>
      {/* FormLabel Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">FormLabel Component</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Required Label</h3>
            <FormLabel htmlFor="required-field" required>
              Required Field
            </FormLabel>
            <input
              id="required-field"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              placeholder="This field is required"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Optional Label</h3>
            <FormLabel htmlFor="optional-field" optional>
              Optional Field
            </FormLabel>
            <input
              id="optional-field"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              placeholder="This field is optional"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">With Tooltip</h3>
            <FormLabel
              htmlFor="tooltip-field"
              tooltip="This is helpful information about the field"
            >
              Field with Help
            </FormLabel>
            <input
              id="tooltip-field"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              placeholder="Hover over the ? icon"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Error State</h3>
            <FormLabel htmlFor="error-field" error>
              Error Field
            </FormLabel>
            <input
              id="error-field"
              className="w-full rounded-md border border-destructive bg-card px-3 py-2 text-sm"
              placeholder="This field has an error"
            />
          </div>
        </div>
      </section>

      {/* Alert Component */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Alert Component</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Variants</h3>
            <div className="space-y-3">
              <Alert variant="info" title="Information" message="This is an info alert" />
              <Alert variant="success" title="Success" message="Operation completed successfully" />
              <Alert variant="warning" title="Warning" message="Please review before proceeding" />
              <Alert variant="error" title="Error" message="Something went wrong" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Features</h3>
            <div className="space-y-3">
              <Alert
                variant="info"
                title="Dismissible Alert"
                message="You can close this alert"
                dismissible
              />
              <Alert
                variant="success"
                title="With Action"
                message="Click the button to perform an action"
                action={{ label: "View Details", onClick: () => alert("Action clicked!") }}
              />
              <Alert
                variant="warning"
                message="Compact alert without title"
                compact
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
