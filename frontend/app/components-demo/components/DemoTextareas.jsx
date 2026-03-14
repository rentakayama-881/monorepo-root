import Textarea from "@/components/ui/Textarea";

export default function DemoTextareas({ textareaValue, setTextareaValue }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold border-b pb-2">Textarea Component</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Auto-resize */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Auto-resize</h3>
          <Textarea
            label="Description"
            placeholder="Type to see auto-resize..."
            autoResize
            minRows={3}
            maxRows={8}
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
          />
        </div>

        {/* With Counter */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">With Character Counter</h3>
          <Textarea
            label="Comment"
            placeholder="Enter your case note"
            maxLength={200}
            showCounter
            hint="Max 200 characters"
          />
        </div>

        {/* Error State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Error State</h3>
          <Textarea
            label="Feedback"
            error="Please provide more details"
            defaultValue="Too short"
          />
        </div>

        {/* Success State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Success State</h3>
          <Textarea
            label="Valid Feedback"
            success
            defaultValue="Thank you for your detailed feedback!"
          />
        </div>
      </div>
    </section>
  );
}
