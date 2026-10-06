import { NextResponse } from "next/server";
import { getResolvedMailConfig } from "@/lib/mail-service";
import { requireUser, requireTenant } from "@/lib/auth";
import { db, appSettings } from "@/lib/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    await requireUser();
    const cfg = getResolvedMailConfig();

    // Check DB integrations for persisted keys
    let dbIntegrations: Record<string, string> = {};
    try {
      const record = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, "system_integrations"),
      });
      if (record?.value && typeof record.value === "object") {
        dbIntegrations = record.value as Record<string, string>;
      }
    } catch {}

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || dbIntegrations.googleApiKey || "";
    const geminiKey = process.env.GEMINI_API_KEY || dbIntegrations.geminiApiKey || "";
    const netlifyTok = process.env.NETLIFY_AUTH_TOKEN || dbIntegrations.netlifyToken || "";

    return NextResponse.json({
      success: true,
      config: {
        smtpHost: cfg.smtpHost || dbIntegrations.smtpHost || "",
        smtpPort: cfg.smtpPort || (dbIntegrations.smtpPort ? parseInt(dbIntegrations.smtpPort, 10) : 587),
        smtpUser: cfg.smtpUser || dbIntegrations.smtpUser || "",
        smtpPass: cfg.smtpPass || dbIntegrations.smtpPass ? "••••••••" : "",
        hasSmtpPass: !!(cfg.smtpPass || dbIntegrations.smtpPass),
        smtpSecure: cfg.smtpSecure,
        smtpFromEmail: cfg.smtpFromEmail || dbIntegrations.smtpFromEmail || "kontakt@procentmarketing.pl",
        smtpFromName: cfg.smtpFromName || dbIntegrations.smtpFromName || "Procent Marketing",

        imapHost: cfg.imapHost || dbIntegrations.imapHost || "",
        imapPort: cfg.imapPort || (dbIntegrations.imapPort ? parseInt(dbIntegrations.imapPort, 10) : 993),
        imapUser: cfg.imapUser || dbIntegrations.imapUser || "",
        imapPass: cfg.imapPass || dbIntegrations.imapPass ? "••••••••" : "",
        hasImapPass: !!(cfg.imapPass || dbIntegrations.imapPass),
        imapTls: cfg.imapTls,

        googleApiKey: googleKey ? "••••••••" : "",
        hasGoogleApiKey: !!googleKey,
        geminiApiKey: geminiKey ? "••••••••" : "",
        hasGeminiApiKey: !!geminiKey,
        netlifyToken: netlifyTok ? "••••••••" : "",
        hasNetlifyToken: !!netlifyTok,
      },
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant();
    const body = await req.json();

    // Fetch existing DB integrations
    let existingIntegrations: Record<string, string> = {};
    try {
      const existing = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, "system_integrations"),
      });
      if (existing?.value && typeof existing.value === "object") {
        existingIntegrations = existing.value as Record<string, string>;
      }
    } catch {}

    const updatedIntegrations = { ...existingIntegrations };

    // Update DB payload (never set process.env in runtime)
    if (body.smtpHost !== undefined) {
      updatedIntegrations.smtpHost = body.smtpHost;
    }
    if (body.smtpPort !== undefined) {
      updatedIntegrations.smtpPort = String(body.smtpPort);
    }
    if (body.smtpUser !== undefined) {
      updatedIntegrations.smtpUser = body.smtpUser;
    }
    if (body.smtpPass && body.smtpPass !== "••••••••") {
      updatedIntegrations.smtpPass = body.smtpPass;
    }
    if (body.smtpFromEmail !== undefined) {
      updatedIntegrations.smtpFromEmail = body.smtpFromEmail;
    }
    if (body.smtpFromName !== undefined) {
      updatedIntegrations.smtpFromName = body.smtpFromName;
    }

    if (body.imapHost !== undefined) {
      updatedIntegrations.imapHost = body.imapHost;
    }
    if (body.imapPort !== undefined) {
      updatedIntegrations.imapPort = String(body.imapPort);
    }
    if (body.imapUser !== undefined) {
      updatedIntegrations.imapUser = body.imapUser;
    }
    if (body.imapPass && body.imapPass !== "••••••••") {
      updatedIntegrations.imapPass = body.imapPass;
    }

    if (body.googleApiKey && body.googleApiKey !== "••••••••") {
      const cleanGKey = body.googleApiKey.trim();
      updatedIntegrations.googleApiKey = cleanGKey;
    }
    if (body.geminiApiKey && body.geminiApiKey !== "••••••••") {
      const cleanGemini = body.geminiApiKey.trim();
      updatedIntegrations.geminiApiKey = cleanGemini;
    }
    if (body.netlifyToken && body.netlifyToken !== "••••••••") {
      const cleanNetlify = body.netlifyToken.trim();
      updatedIntegrations.netlifyToken = cleanNetlify;
    }

    // Persist permanently to PostgreSQL app_settings table
    try {
      const existing = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, "system_integrations"),
      });

      if (existing) {
        await db
          .update(appSettings)
          .set({
            value: updatedIntegrations,
            updatedAt: new Date(),
          })
          .where(eq(appSettings.key, "system_integrations"));
      } else {
        await db.insert(appSettings).values({
          tenantId,
          key: "system_integrations",
          value: updatedIntegrations,
          updatedAt: new Date(),
        });
      }
    } catch (dbErr) {
      console.warn("Could not save to appSettings table:", dbErr);
    }

    // Persist to local .env.local file if possible
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
      console.warn("Could not save to .env.local file directly:", saveErr);
    }

    return NextResponse.json({
      success: true,
      message: "Konfiguracja integracji oraz serwerów poczty została pomyślnie zapisana.",
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError") {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
