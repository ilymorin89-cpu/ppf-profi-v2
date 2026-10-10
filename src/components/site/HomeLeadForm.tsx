"use client";

import { useState } from "react";
import LeadForm from "@/components/forms/LeadForm";
import type { FormContent } from "@/components/forms/FormParts";

type Props = {
  content: FormContent;
  cars: { code: string; label: string }[];
  defaults: { scenario: string; filmCode: string };
  submitLabel: string;
  successTitle: string;
  successText: string;
};

export default function HomeLeadForm({ successTitle, successText, ...props }: Props) {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-2xl border border-lime-400/30 bg-lime-400/5 p-6 text-center">
        <div className="text-2xl font-extrabold accent">{successTitle}</div>
        <p className="mt-2 text-sm text-white/70">{successText}</p>
      </div>
    );
  }
  return <LeadForm {...props} onSuccess={() => setSent(true)} />;
}
