"use client";

import React, { useState } from "react";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import FormLabel from "@/components/ui/FormLabel";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function ComponentsDemoContent() {
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [multiSelectValue, setMultiSelectValue] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState("md");
  const { toast } = useToast();

  const sampleOptions = [
    { value: "react", label: "React", group: "Frontend" },
    { value: "vue", label: "Vue", group: "Frontend" },
    { value: "angular", label: "Angular", group: "Frontend" },
    { value: "node", label: "Node.js", group: "Backend" },
    { value: "python", label: "Python", group: "Backend" },
    { value: "go", label: "Go", group: "Backend" },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            Form Components Demo - Phase 2
          </h1>
          <p className="text-muted-foreground">
            Premium UI/UX enhancements for Alephdraad
          </p>
        </div>

        {/* Input Components */}
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

        {/* Textarea Component */}
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
                placeholder="Enter your comment"
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

        {/* Select Component */}
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

        {/* Form Example */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Complete Form Example</h2>
          
          <form className="max-w-2xl space-y-6 p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-semibold">Create New Thread</h3>
            
            <Input
              label="Title"
              placeholder="Enter thread title"
              required
              maxLength={100}
              showCounter
              size="lg"
            />

            <Textarea
              label="Content"
              placeholder="Write your thread content..."
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
                { value: "general", label: "General Discussion" },
                { value: "help", label: "Help & Support" },
                { value: "showcase", label: "Showcase" },
                { value: "feedback", label: "Feedback" },
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
                Create Thread
              </Button>
              <Button type="button" variant="ghost">
                Save Draft
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function ComponentsDemo() {
  return (
    <ToastProvider position="bottom-right">
      <ComponentsDemoContent />
    </ToastProvider>
  );
}
