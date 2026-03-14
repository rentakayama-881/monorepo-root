import Input from "@/components/ui/Input";

export default function DemoInputs({ inputValue, setInputValue }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold border-b pb-2">Input Component</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Input */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Basic Input</h3>
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            hint="We'll never share your email"
            required
          />
        </div>

        {/* Input with Icons */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">With Icons</h3>
          <Input
            label="Search"
            placeholder="Search..."
            iconLeft={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            clearable
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        {/* Floating Label */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Floating Label</h3>
          <Input
            label="Username"
            placeholder=" "
            floatingLabel
            required
          />
        </div>

        {/* Size Variants */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Size Variants</h3>
          <Input size="sm" placeholder="Small input" />
          <Input size="md" placeholder="Medium input (default)" />
          <Input size="lg" placeholder="Large input" />
        </div>

        {/* Error State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Error State</h3>
          <Input
            label="Password"
            type="password"
            error="Password must be at least 8 characters"
            defaultValue="short"
          />
        </div>

        {/* Success State */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Success State</h3>
          <Input
            label="Valid Email"
            type="email"
            success
            defaultValue="user@example.com"
          />
        </div>

        {/* Character Counter */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Character Counter</h3>
          <Input
            label="Bio"
            placeholder="Tell us about yourself"
            maxLength={50}
            showCounter
          />
        </div>
      </div>
    </section>
  );
}
