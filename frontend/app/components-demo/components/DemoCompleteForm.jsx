import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

export default function DemoCompleteForm() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold border-b pb-2">Complete Form Example</h2>
      
      <form className="max-w-2xl space-y-6 p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold">Create New Validation Case</h3>
        
        <Input
          label="Title"
          placeholder="Enter case title"
          required
          maxLength={100}
          showCounter
          size="lg"
        />

        <Textarea
          label="Content"
          placeholder="Write the case record (scope, evidence, and acceptance criteria)..."
          required
          autoResize
          minRows={5}
          maxRows={15}
          maxLength={5000}
          showCounter
          hint="Markdown is supported"
        />

        <Select
          label="Category"
          placeholder="Select a category"
          required
          options={[
            { value: "academic", label: "Academic Validation" },
            { value: "legal", label: "Legal Review" },
            { value: "financial", label: "Financial Review" },
            { value: "technical", label: "Technical Review" },
          ]}
        />

        <Select
          label="Tags"
          placeholder="Select tags"
          multiSelect
          searchable
          options={[
            { value: "javascript", label: "JavaScript" },
            { value: "react", label: "React" },
            { value: "nodejs", label: "Node.js" },
            { value: "typescript", label: "TypeScript" },
            { value: "css", label: "CSS" },
          ]}
          hint="You can select multiple tags"
        />

        <div className="flex gap-3 pt-4">
          <Button type="submit" variant="default">
            Create Validation Case
          </Button>
          <Button type="button" variant="ghost">
            Save Draft
          </Button>
        </div>
      </form>
    </section>
  );
}
