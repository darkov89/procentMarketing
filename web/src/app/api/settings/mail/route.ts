import { NextResponse } from "next/server";
import { getResolvedMailConfig } from "@/lib/mail-service";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const cfg = getResolvedMailConfig();
    return NextResponse.json({
      success: true,
      config: {
        smtpHost: cfg.smtpHost || "",
        smtpPort: cfg.smtpPort || 587,
        smtpUser: cfg.smtpUser || "",
        smtpPass: cfg.smtpPass ? "••••••••" : "",
        hasSmtpPass: !!cfg.smtpPass,
        smtpSecure: cfg.smtpSecure,
        smtpFromEmail: cfg.smtpFromEmail || "kontakt@procentmarketing.pl",
        smtpFromName: cfg.smtpFromName || "Procent Marketing",

        imapHost: cfg.imapHost || "",
        imapPort: cfg.imapPort || 993,
        imapUser: cfg.imapUser || "",
        imapPass: cfg.imapPass ? "••••••••" : "",
        hasImapPass: !!cfg.imapPass,
        imapTls: cfg.imapTls,

        googleApiKey: process.env.GOOGLE_MAPS_API_KEY ? "••••••••" : "",
        hasGoogleApiKey: !!process.env.GOOGLE_MAPS_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY ? "••••••••" : "",
        hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
        netlifyToken: process.env.NETLIFY_AUTH_TOKEN ? "••••••••" : "",
        hasNetlifyToken: !!process.env.NETLIFY_AUTH_TOKEN,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Update in-memory process.env
    if (body.smtpHost !== undefined) process.env.SMTP_HOST = body.smtpHost;
    if (body.smtpPort !== undefined) process.env.SMTP_PORT = String(body.smtpPort);
    if (body.smtpUser !== undefined) process.env.SMTP_USER = body.smtpUser;
    if (body.smtpPass && body.smtpPass !== "••••••••") process.env.SMTP_PASSWORD = body.smtpPass;
    if (body.smtpFromEmail !== undefined) process.env.SMTP_FROM_EMAIL = body.smtpFromEmail;
    if (body.smtpFromName !== undefined) process.env.SMTP_FROM_NAME = body.smtpFromName;

    if (body.imapHost !== undefined) process.env.IMAP_HOST = body.imapHost;
    if (body.imapPort !== undefined) process.env.IMAP_PORT = String(body.imapPort);
    if (body.imapUser !== undefined) process.env.IMAP_USER = body.imapUser;
    if (body.imapPass && body.imapPass !== "••••••••") process.env.IMAP_PASSWORD = body.imapPass;

    if (body.googleApiKey && body.googleApiKey !== "••••••••") {
      process.env.GOOGLE_MAPS_API_KEY = body.googleApiKey;
    }
    if (body.geminiApiKey && body.geminiApiKey !== "••••••••") {
      process.env.GEMINI_API_KEY = body.geminiApiKey;
    }
    if (body.netlifyToken && body.netlifyToken !== "••••••••") {
      process.env.NETLIFY_AUTH_TOKEN = body.netlifyToken;
    }

    // Persist to web/.env.local if writable
    try {
      const envPath = path.resolve(process.cwd(), ".env.local");
      let currentContent = "";
      if (fs.existsSync(envPath)) {
        currentContent = fs.readFileSync(envPath, "utf-8");
      }

      const updates: Record<string, string> = {
        SMTP_HOST: process.env.SMTP_HOST || "",
        SMTP_PORT: process.env.SMTP_PORT || "587",
        SMTP_USER: process.env.SMTP_USER || "",
        SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "kontakt@procentmarketing.pl",
        SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || "Procent Marketing",
        IMAP_HOST: process.env.IMAP_HOST || "",
        IMAP_PORT: process.env.IMAP_PORT || "993",
        IMAP_USER: process.env.IMAP_USER || "",
      };

      if (process.env.SMTP_PASSWORD) updates.SMTP_PASSWORD = process.env.SMTP_PASSWORD;
      if (process.env.IMAP_PASSWORD) updates.IMAP_PASSWORD = process.env.IMAP_PASSWORD;
      if (process.env.GOOGLE_MAPS_API_KEY) updates.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
      if (process.env.GEMINI_API_KEY) updates.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (process.env.NETLIFY_AUTH_TOKEN) updates.NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;

      const lines = currentContent.split("\n");
      const existingKeys = new Set<string>();

      const newLines = lines.map((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) {
          const key = match[1];
          existingKeys.add(key);
          if (updates[key] !== undefined) {
            return `${key}="${updates[key]}"`;
          }
        }
        return line;
      });

      for (const [key, val] of Object.entries(updates)) {
        if (!existingKeys.has(key) && val) {
          newLines.push(`${key}="${val}"`);
        }
      }

      fs.writeFileSync(envPath, newLines.join("\n").trim() + "\n", "utf-8");
    } catch (saveErr) {
      console.warn("Could not save to .env.local file directly (possibly read-only env):", saveErr);
    }

    return NextResponse.json({
      success: true,
      message: "Konfiguracja serwerów poczty została zaktualizowana i zapisana!",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
