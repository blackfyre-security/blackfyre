"use client";

import { useState } from "react";

const inputClass =
  "w-full border-0 border-b border-border bg-transparent py-3 text-[15px] text-text placeholder:text-text-dim transition-colors focus:border-accent focus:outline-none";

const labelClass = "halo-label mb-2 block";

const errorClass = "mt-2 font-mono text-xs uppercase tracking-[0.18em] text-crit";

interface ContactFormProps {
  successLabel?: string;
  onSuccess?: () => void;
}

export default function ContactForm({
  successLabel = "Send another note",
  onSuccess,
}: ContactFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    topic: "",
    message: "",
    // Honeypot — real users never fill this. Bots that auto-populate every
    // input do, and the API marks the submission as spam.
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    if (!form.message.trim()) next.message = "A short message helps us route this.";
    return next;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      if (!apiUrl) {
        setSubmitError(
          "Contact backend not configured. Email marketing@blackfyre.tech directly."
        );
        return;
      }
      const res = await fetch(`${apiUrl}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          topic: form.topic || undefined,
          message: form.message,
          source: "website-contact",
          website: form.website,
        }),
        keepalive: true,
      });
      if (!res.ok) {
        setSubmitError(
          "Couldn't send your note — please email marketing@blackfyre.tech."
        );
        return;
      }
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setSubmitError(
        "Network hiccup — please email marketing@blackfyre.tech."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5 py-4">
        <p className="halo-eyebrow">§ Sent</p>
        <h3 className="font-display text-[22px] font-medium leading-[1.2] tracking-display text-text">
          Thanks — we&apos;ll be in touch.
        </h3>
        <p className="text-[14px] leading-relaxed text-text-muted">
          A human reads every note that lands at marketing@blackfyre.tech.
          Expect a reply within 24 hours.
        </p>
        <button
          type="button"
          className="halo-btn-ghost mt-2"
          onClick={() => {
            setSubmitted(false);
            setForm({
              name: "",
              email: "",
              company: "",
              topic: "",
              message: "",
              website: "",
            });
          }}
        >
          {successLabel}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-7">
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          className={inputClass}
          placeholder="Ada Lovelace"
        />
        {errors.name && <p className={errorClass}>{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="contact-email" className={labelClass}>
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          className={inputClass}
          placeholder="ada@example.com"
        />
        {errors.email && <p className={errorClass}>{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="contact-company" className={labelClass}>
          Company <span className="font-normal text-text-dim">(optional)</span>
        </label>
        <input
          id="contact-company"
          name="company"
          type="text"
          autoComplete="organization"
          value={form.company}
          onChange={handleChange}
          className={inputClass}
          placeholder="Analytical Engines, Inc."
        />
      </div>

      <div>
        <label htmlFor="contact-topic" className={labelClass}>
          Topic <span className="font-normal text-text-dim">(optional)</span>
        </label>
        <input
          id="contact-topic"
          name="topic"
          type="text"
          value={form.topic}
          onChange={handleChange}
          className={inputClass}
          placeholder="SOC 2 prep, vCISO, partnership…"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          value={form.message}
          onChange={handleChange}
          className={`${inputClass} resize-y`}
          placeholder="What are you trying to solve?"
        />
        {errors.message && <p className={errorClass}>{errors.message}</p>}
      </div>

      {/* Honeypot — visually hidden */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={handleChange}
        />
      </div>

      {submitError && <p className={errorClass}>{submitError}</p>}

      <button
        type="submit"
        className="halo-btn-accent"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send message →"}
      </button>
    </form>
  );
}
