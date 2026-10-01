import { z } from "zod";

export const scheduleEmailSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required.")
    .max(200, "Subject cannot exceed 200 characters."),

  body: z
    .string()
    .trim()
    .min(1, "Email body is required."),

  recipients: z
    .array(
      z.object({
        email: z
          .string()
          .trim()
          .email("Invalid recipient email address."),

        name: z
          .string()
          .trim()
          .max(100)
          .optional(),
      }),
    )
    .min(1, "At least one recipient is required."),

  startTime: z
    .string()
    .datetime({
      offset: true,
    }),

  delaySeconds: z
    .number()
    .int()
    .min(0)
    .max(86400),

  hourlyLimit: z
    .number()
    .int()
    .positive()
    .max(100000),
});

export type ScheduleEmailInput = z.infer<
  typeof scheduleEmailSchema
>;