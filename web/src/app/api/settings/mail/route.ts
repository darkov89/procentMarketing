import { NextResponse } from "next/server";
import { getResolvedMailConfig } from "@/lib/mail-service";
import { requireTenant } from "@/lib/auth";
import { db, appSettings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { setSecret, getSecret, hasSecret } from "@/lib/secrets";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const cfg = getResolvedMailConfig();

    // Check DB integrations for non-secret configs
    let dbIntegrations: Record<string, string> = {};
    try {
      const record = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, "system_integrations"),
      });
      if (record?.value && typeof record.value === "object") {
        dbIntegrations = record.value as Record<string, string>;
      }
    } catch {}

    const hasSmtpSecret = (await hasSecret(tenantId, "smtp_password")) || !!cfg.smtpPass;
    const hasImapSecret = (await hasSecret(tenantId, "imap_password")) || !!cfg.imapPass;
    const hasGoogleKey = (await hasSecret(tenantId, "google_api_key")) || !!process.env.GOOGLE_MAPS_API_KEY;
    const hasGeminiKey = (await hasSecret(tenantId, "gemini_api_key")) || !!process.env.GEMINI_API_KEY;
    const hasNetlifyTok = (await hasSecret(tenantId, "netlify_token")) || !!process.env.NETLIFY_AUTH_TOKEN;

    return NextResponse.json({
      success: true,
      config: {
        smtpHost: cfg.smtpHost || dbIntegrations.smtpHost || "",
        smtpPort: cfg.smtpPort || (dbIntegrations.smtpPort ? parseInt(dbIntegrations.smtpPort, 10) : 587),
        smtpUser: cfg.smtpUser || dbIntegrations.smtpUser || "",
        smtpPass: hasSmtpSecret ? "••••••••" : "",
        hasSmtpPass: hasSmtpSecret,
        smtpSecure: cfg.smtpSecure,
        smtpFromEmail: cfg.smtpFromEmail || dbIntegrations.smtpFromEmail || "kontakt@procentmarketing.pl",
        smtpFromName: cfg.smtpFromName || dbIntegrations.smtpFromName || "Procent Marketing",

        imapHost: cfg.imapHost || dbIntegrations.imapHost || "",
        imapPort: cfg.imapPort || (dbIntegrations.imapPort ? parseInt(dbIntegrations.imapPort, 10) : 993),
        imapUser: cfg.imapUser || dbIntegrations.imapUser || "",
        imapPass: hasImapSecret ? "••••••••" : "",
        hasImapPass: hasImapSecret,
        imapTls: cfg.imapTls,

        googleApiKey: hasGoogleKey ? "••••••••" : "",
        hasGoogleApiKey: hasGoogleKey,
        geminiApiKey: hasGeminiKey ? "••••••••" : "",
        hasGeminiApiKey: hasGeminiKey,
        netlifyToken: hasNetlifyTok ? "••••••••" : "",
        hasNetlifyToken: hasNetlifyTok,
      },
    });
  } catch (err: any) {
    if (err?.name === "AuthenticationError" || err?.name === "AuthorizationError") {
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

    // Save sensitive credentials into encrypted tenant_secrets (R9)
    if (body.smtpPass && body.smtpPass !== "••••••••") {
      await setSecret(tenantId, "smtp_password", body.smtpPass);
    }
    if (body.imapPass && body.imapPass !== "••••••••") {
      await setSecret(tenantId, "imap_password", body.imapPass);
    }
    if (body.googleApiKey && body.googleApiKey !== "••••••••") {
      await setSecret(tenantId, "google_api_key", body.googleApiKey.trim());
    }
    if (body.geminiApiKey && body.geminiApiKey !== "••••••••") {
      await setSecret(tenantId, "gemini_api_key", body.geminiApiKey.trim());
    }
    if (body.netlifyToken && body.netlifyToken !== "••••••••") {
      await setSecret(tenantId, "netlify_token", body.netlifyToken.trim());
    }

    // Persist permanently non-secret settings to PostgreSQL app_settings table
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
