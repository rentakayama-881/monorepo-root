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
      <h2 className="text-2xl font-semibold border-b pb-2">Select Component</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Basic Select</h3>
          <Select
            label="Framework"
            placeholder="Select a framework"
            options={sampleOptions}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          />
        </div>

        {/* Searchable Select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Searchable</h3>
          <Select
            label="Technology"
            placeholder="Search technology..."
            options={sampleOptions}
            searchable
          />
        </div>

        {/* Multi-select */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Multi-select</h3>
          <Select
            label="Skills"
            placeholder="Select multiple skills"
            options={sampleOptions}
            multiSelect
            searchable
            value={multiSelectValue}
            onChange={(e) => setMultiSelectValue(e.target.value)}
          />
        </div>

        {/* With Groups */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">With Option Groups</h3>
          <Select
            label="Tech Stack"
            placeholder="Select from groups"
            options={sampleOptions}
            searchable
          />
        </div>

        {/* Loading State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Loading State</h3>
          <Select
            label="Loading..."
            placeholder="Fetching options..."
            options={[]}
            loading
          />
        </div>

        {/* Empty State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Empty State</h3>
          <Select
            label="No Options"
            placeholder="No options available"
            options={[]}
            emptyMessage="No technologies found"
          />
        </div>
      </div>
    </section>
  );
}
