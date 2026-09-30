import type { ToolType } from "@/lib/types";

/**
 * Starting statements and guidance for a newly created spam detector, so the
 * form opens with something usable rather than an empty box the admin has to
 * fill before it will save.
 *
 * Prefilled as real values, not placeholders: placeholder text reads as content
 * while submitting nothing, so the first save fails validation on a field that
 * looked already filled in.
 *
 * These mirror the rows seeded in supabase/migrations/0020_spam_detection_tools.sql
 * -- that copy is what existing installs already have, this one is for detectors
 * created from scratch afterwards. They only have to agree in spirit; editing
 * either is expected, and the seeded rows are editable in this same form.
 *
 * Deliberately narrow. A detector ends calls with nothing spoken, so a
 * too-broad list fails by hanging up on real customers who never tell you --
 * widen it from what actually shows up in call_logs.spam_detection.
 */
export const DETECTOR_DEFAULTS: Partial<
  Record<ToolType, { description: string; statements: string[] }>
> = {
  detect_bot_call: {
    description:
      "Automated systems: answering machines, IVR menus, voicemail greetings and recorded " +
      "robocalls. Anything where no live person is on the line.",
    statements: [
      "press one to speak to a representative",
      "your call is important to us",
      "please leave a message after the tone",
      "this call is being recorded for quality assurance",
      "the person you are calling is not available",
      "if you would like to be removed from our list",
    ],
  },
  detect_sales_call: {
    description:
      "Someone cold-selling to us: agencies, SEO and business-listing pitches, lead " +
      "generation, and software vendors. Not a customer asking about our own services, " +
      "however they open.",
    statements: [
      "i am calling about your google business listing",
      "we can help you rank higher on google",
      "i wanted to talk to you about your website",
      "we help companies like yours generate more leads",
      "is the owner or decision maker available",
      "i am calling from a digital marketing agency",
    ],
  },
};
