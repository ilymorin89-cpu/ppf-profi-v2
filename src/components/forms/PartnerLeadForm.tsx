"use client";

import { useState, useId } from "react";
import { postLead, type SubmitResult } from "./submit";
import { trackGoal } from "@/shared/analytics";
import {
  ConsentCheckbox,
  FieldError,
  ReferralInput,
  SubmitError,
  fieldErrors,
  inputClass,
  labelClass,
  type FormContent,
} from "./FormParts";

type Props = {
  content: FormContent;
  types: { code: string; label: string }[];
  texts: {
    company: string;
    companyPlaceholder: string;
    type: string;
    city: string;
    cityPlaceholder: string;
    carsPerMonth: string;
    contact: string;
    contactPlaceholder: string;
    submit: string;
    successTitle: string;
    successText: string;
  };
};

export default function PartnerLeadForm({ content, types, texts }: Props) {
  const uid = useId();
  const [company, setCompany] = useState("");
  const [companyType, setCompanyType] = useState(types[0]?.code ?? "");
  const [city, setCity] = useState("");
  const [cars, setCars] = useState("");
  const [contact, setContact] = useState("");
  const [referral, setReferral] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sent, setSent] = useState(false);

  const errors = fieldErrors(result);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setResult(null);
    const r = await postLead({
      kind: "partner",
      company,
      companyType,
      city,
      carsPerMonth: cars === "" ? null : Number(cars),
      clientPhone: contact,
      referral,
      consent,
    });
    setSending(false);
    if (r.kind === "ok") {
      trackGoal("lead_success", { form: "partner" });
      setSent(true);
    }
    else setResult(r);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-lime-400/30 bg-lime-400/5 p-6 text-center">
        <div className="text-2xl font-extrabold accent">{texts.successTitle}</div>
        <p className="mt-2 text-sm text-white/70">{texts.successText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor={`${uid}-1`} className={labelClass}>{texts.company}</label>
        <input id={`${uid}-1`}
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder={texts.companyPlaceholder}
          autoComplete="organization"
          className={inputClass}
        />
        <FieldError message={errors.company} />
      </div>

      <div>
        <label htmlFor={`${uid}-2`} className={labelClass}>{texts.type}</label>
        <select id={`${uid}-2`} value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputClass}>
          {types.map((t) => (
            <option key={t.code} value={t.code} className="bg-neutral-900 text-white">
              {t.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.companyType} />
      </div>

      <div>
        <label htmlFor={`${uid}-3`} className={labelClass}>{texts.city}</label>
        <input id={`${uid}-3`}
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={texts.cityPlaceholder}
          autoComplete="address-level2"
          className={inputClass}
        />
        <FieldError message={errors.city} />
      </div>

      <div>
        <label htmlFor={`${uid}-4`} className={labelClass}>{texts.carsPerMonth}</label>
        <input id={`${uid}-4`}
          type="text"
          inputMode="numeric"
          value={cars}
          onChange={(e) => setCars(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="20"
          className={inputClass}
        />
        <FieldError message={errors.carsPerMonth} />
      </div>

      <div>
        <label htmlFor={`${uid}-5`} className={labelClass}>{texts.contact}</label>
        <input id={`${uid}-5`}
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={texts.contactPlaceholder}
          className={inputClass}
        />
        <FieldError message={errors.clientPhone} />
      </div>

      <ReferralInput value={referral} onChange={setReferral} texts={content.texts} />

      <div className="sm:col-span-2">
        <ConsentCheckbox
          checked={consent}
          onChange={setConsent}
          texts={content.texts}
          error={errors.consent}
        />
      </div>

      <div className="sm:col-span-2">
        <SubmitError result={result} content={content} />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="btn-accent justify-center disabled:opacity-50 sm:col-span-2"
      >
        {sending ? content.texts.sending : texts.submit}
      </button>
    </form>
  );
}
