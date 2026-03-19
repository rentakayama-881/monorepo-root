"use client";

import React, { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import DemoInputs from "./components/DemoInputs";
import DemoTextareas from "./components/DemoTextareas";
import DemoSelects from "./components/DemoSelects";
import DemoFormElements from "./components/DemoFormElements";
import DemoModals from "./components/DemoModals";
import DemoCompleteForm from "./components/DemoCompleteForm";

function ComponentsDemoContent() {
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [multiSelectValue, setMultiSelectValue] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState("md");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Preview Komponen Internal</h1>
          <p className="text-muted-foreground">
            Sandbox internal untuk mengecek komponen form, modal, dan pola interaksi AIValid.
          </p>
        </div>

        <DemoInputs inputValue={inputValue} setInputValue={setInputValue} />
        <DemoTextareas textareaValue={textareaValue} setTextareaValue={setTextareaValue} />
        <DemoSelects
          selectValue={selectValue}
          setSelectValue={setSelectValue}
          multiSelectValue={multiSelectValue}
          setMultiSelectValue={setMultiSelectValue}
        />
        <DemoFormElements />
        <DemoModals
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          modalSize={modalSize}
          setModalSize={setModalSize}
        />
        <DemoCompleteForm />
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
