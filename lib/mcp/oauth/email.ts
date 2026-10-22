import { Resend } from "resend";

/** Emails a sign-in code with Resend. Without RESEND_API_KEY outside
 *  production, prints it to the server log instead ("dev"). */
export async function sendSignInCode(to: string, code: string, app: string): Promise<"sent" | "dev"> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.log(`[walkoff oauth] sign-in code for ${to}: ${code}`);
    return "dev";
  }
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const { error } = await new Resend(key).emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Walkoff <onboarding@resend.dev>",
    to,
    subject: `Your Walkoff code: ${spaced}`,
    text: [
      `Your code to connect Walkoff to ${app} is ${spaced}.`,
      "",
      "It works for 15 minutes. If you didn't try to connect Walkoff, ignore this email: nothing happens without the code.",
      "",
      "Walkoff · walkoff.io",
    ].join("\n"),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return "sent";
}
