"use client";

import { useState, useId } from "react";
import { postLead, type SubmitResult } from "./submit";
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

/** addons — количество по коду допа; цену сервер считает сам. */
type Selection = {
  carCode: string;
  scenario: string;
  filmCode: string;
  addons?: Record<string, number>;
};

type Props = {
  content: FormContent;
  /** Выбор из калькулятора. Если не задан — форма показывает список моделей. */
  selection?: Selection;
  cars?: { code: string; label: string }[];
  defaults?: { scenario: string; filmCode: string };
  modelLabel?: string;
  submitLabel: string;
  onSuccess: (publicNumber?: string) => void;
};

export default function LeadForm({
  content,
  selection,
  cars = [],
  defaults,
  modelLabel = "Модель",
  submitLabel,
  onSuccess,
}: Props) {
  const uid = useId();
  const [carCode, setCarCode] = useState(selection?.carCode ?? cars[0]?.code ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const errors = fieldErrors(result);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setResult(null);
    const r = await postLead({
      kind: "client",
      carCode: selection?.carCode ?? carCode,
      scenario: selection?.scenario ?? defaults?.scenario ?? "",
      filmCode: selection?.filmCode ?? defaults?.filmCode ?? "",
      addons: selection?.addons ?? {},
      clientName: name,
      clientPhone: phone,
      referral,
      consent,
    });
    setSending(false);
    if (r.kind === "ok") onSuccess(r.publicNumber);
    else setResult(r);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!selection && cars.length > 0 && (
        <div>
          <label htmlFor={`${uid}-1`} className={labelClass}>{modelLabel}</label>
          <select id={`${uid}-1`}
            value={carCode}
            onChange={(e) => setCarCode(e.target.value)}
            className={inputClass}
          >
            {cars.map((c) => (
              <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                {c.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.carCode} />
        </div>
      )}

      <div>
        <label htmlFor={`${uid}-2`} className={labelClass}>Ваше имя</label>
        <input id={`${uid}-2`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Иван"
          autoComplete="name"
          className={inputClass}
        />
        <FieldError message={errors.clientName} />
      </div>

      <div>
        <label htmlFor={`${uid}-3`} className={labelClass}>Телефон</label>
        <input id={`${uid}-3`}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 999 123-45-67"
          autoComplete="tel"
          className={inputClass}
        />
        <FieldError message={errors.clientPhone} />
      </div>

      <ReferralInput value={referral} onChange={setReferral} texts={content.texts} />

      <ConsentCheckbox
        checked={consent}
        onChange={setConsent}
        texts={content.texts}
        error={errors.consent}
      />

      <SubmitError result={result} content={content} />

      <button
        type="submit"
        disabled={sending}
        className="btn-accent w-full justify-center disabled:opacity-50"
      >
        {sending ? content.texts.sending : submitLabel}
      </button>
    </form>
  );
}
