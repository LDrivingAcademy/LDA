"use client";

import { Download } from "lucide-react";

type ReceiptPrintButtonProps = {
  className?: string;
};

export function ReceiptPrintButton({ className }: ReceiptPrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex min-h-11 items-center gap-2 rounded bg-brand px-5 text-sm font-black text-white hover:bg-red-700"
      }
    >
      <Download size={17} /> Save or print receipt
    </button>
  );
}
