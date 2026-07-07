import { z } from "zod";

// Topics offered to the visitor on the marketing booking form. Mirrored in
// website/src/components/BookingForm.tsx; keep these in sync if the menu
// changes. Validation here is permissive (.optional() + .or(z.literal(""))).
export const contactInterestOptions = [
  "Platform — Comply Tier",
  "Platform — Protect Tier",
  "Platform — Defend Tier",
  "Professional Services",
  "Platform + Services Bundle",
  "Free Discovery Call",
  "Other",
] as const;

export const contactSubmissionStatusValues = [
  "new", "contacted", "qualified", "archived", "spam",
] as const;
export type ContactSubmissionStatus = (typeof contactSubmissionStatusValues)[number];

// Honeypot: form renders a hidden `website` input that real users never fill;
// bots that auto-populate every text field do. Any non-empty value -> spam.
export const contactSubmissionInputSchema = z.object({
  name:          z.string().trim().min(1, "Name is required.").max(200),
  email:         z.string().trim().toLowerCase().email("Enter a valid email address.").max(320),
  company:       z.string().trim().max(200).optional(),
  preferredDate: z.string().trim().max(32).optional(),
  preferredTime: z.string().trim().max(32).optional(),
  topic:         z.string().trim().max(100).optional(),
  message:       z.string().trim().max(2000).optional(),
  source:        z.string().trim().max(64).optional(),
  // Honeypot — any value at all (even garbage) is accepted by the schema so
  // bots that submit nonsense get the same 202 a human gets. The handler
  // inspects this field separately and tags the row `status='spam'` when
  // it's non-empty. Schema rejection would tell bots they were caught.
  website:       z.string().optional(),
});
export type ContactSubmissionInput = z.infer<typeof contactSubmissionInputSchema>;

export const updateContactSubmissionSchema = z.object({
  status: z.enum(contactSubmissionStatusValues).optional(),
  notes:  z.string().trim().max(2000).optional(),
});
export type UpdateContactSubmissionInput = z.infer<typeof updateContactSubmissionSchema>;

export const leadNotificationRecipientInputSchema = z.object({
  email:    z.string().trim().toLowerCase().email().max(320),
  name:     z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
});
export type LeadNotificationRecipientInput = z.infer<typeof leadNotificationRecipientInputSchema>;

export const updateLeadNotificationRecipientSchema = z.object({
  name:     z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLeadNotificationRecipientInput = z.infer<typeof updateLeadNotificationRecipientSchema>;
