import nodemailer from "nodemailer";
import crypto from "crypto";
export const otpHash = (otp) => crypto.createHash("sha256").update(otp).digest("hex");
export const makeOtp = () => String(crypto.randomInt(100000, 1000000));
export async function sendOtp(email, otp, purpose) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(`[DEV ONLY] ${purpose} OTP for ${email}: ${otp}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER, to: email, subject: `SchoolSphere ${purpose} code`,
    text: `Your SchoolSphere ${purpose.toLowerCase()} code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`
  });
}
