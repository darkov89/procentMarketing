import React from "react";
import { Server, Inbox, Key, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export interface MailSettingsState {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapTls: boolean;
  googleApiKey: string;
  geminiApiKey: string;
  netlifyToken: string;
  hasSmtpPass?: boolean;
  hasImapPass?: boolean;
  hasGoogleApiKey?: boolean;
  hasGeminiApiKey?: boolean;
  hasNetlifyToken?: boolean;
}

interface MailAndApiSectionProps {
  settings: MailSettingsState;
  onChange: (settings: MailSettingsState) => void;
  onTestSmtp: () => Promise<void>;
  smtpTesting: boolean;
  onTestImap: () => Promise<void>;
  imapTesting: boolean;
  onTestGoogleApi: () => Promise<void>;
  googleTesting: boolean;
  googleDiagnostic: {
    tested: boolean;
    success: boolean;
    message: string;
    hint?: string;
  } | null;
}

export function MailAndApiSection({
  settings,
  onChange,
  onTestSmtp,
  smtpTesting,
  onTestImap,
  imapTesting,
  onTestGoogleApi,
  googleTesting,
  googleDiagnostic,
}: MailAndApiSectionProps) {
  return (
    <div className="space-y-6">
      {/* SMTP Configuration Form */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FFE600]/10 text-[#FFE600] rounded-lg">
              <Server size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Serwer Poczty Wychodzącej (SMTP)</h3>
              <p className="text-xs text-[#94A3B8]">Wysyłka spersonalizowanych propozycji i audytów (Sandbox / Live)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTestSmtp}
            disabled={smtpTesting}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#FFE600]/40 text-[#FFE600] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={smtpTesting ? "animate-spin" : ""} />
            {smtpTesting ? "Testowanie..." : "Testuj połączenie SMTP"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Host SMTP</label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => onChange({ ...settings, smtpHost: e.target.value })}
              placeholder="np. smtp.gmail.com lub mail.twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Port SMTP</label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) =>
                onChange({
                  ...settings,
                  smtpPort: parseInt(e.target.value, 10) || 587,
                })
              }
              placeholder="587 (STARTTLS) lub 465 (SSL)"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Użytkownik / Login</label>
            <input
              type="text"
              value={settings.smtpUser}
              onChange={(e) => onChange({ ...settings, smtpUser: e.target.value })}
              placeholder="kontakt@twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Hasło / Hasło Aplikacji</label>
            <input
              type="password"
              value={settings.smtpPass}
              onChange={(e) => onChange({ ...settings, smtpPass: e.target.value })}
              placeholder={
                settings.hasSmtpPass
                  ? "•••••••• (pozostaw puste aby nie zmieniać)"
                  : "Wpisz hasło"
              }
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Adres Nadawcy (From Email)</label>
            <input
              type="text"
              value={settings.smtpFromEmail}
              onChange={(e) => onChange({ ...settings, smtpFromEmail: e.target.value })}
              placeholder="kontakt@procentmarketing.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Nazwa Nadawcy (From Name)</label>
            <input
              type="text"
              value={settings.smtpFromName}
              onChange={(e) => onChange({ ...settings, smtpFromName: e.target.value })}
              placeholder="Procent Marketing"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
        </div>
      </div>

      {/* IMAP Configuration Form */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#28354D] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg">
              <Inbox size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Serwer Poczty Przychodzącej (IMAP - Monitor)</h3>
              <p className="text-xs text-[#94A3B8]">Automatyczne wykrywanie odpowiedzi, pytań i żądań wypisania STOP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTestImap}
            disabled={imapTesting}
            className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#38BDF8]/40 text-[#38BDF8] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={imapTesting ? "animate-spin" : ""} />
            {imapTesting ? "Testowanie..." : "Testuj połączenie IMAP"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Host IMAP</label>
            <input
              type="text"
              value={settings.imapHost}
              onChange={(e) => onChange({ ...settings, imapHost: e.target.value })}
              placeholder="np. imap.gmail.com lub mail.twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Port IMAP</label>
            <input
              type="number"
              value={settings.imapPort}
              onChange={(e) =>
                onChange({
                  ...settings,
                  imapPort: parseInt(e.target.value, 10) || 993,
                })
              }
              placeholder="993 (SSL) lub 143 (STARTTLS)"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Użytkownik IMAP</label>
            <input
              type="text"
              value={settings.imapUser}
              onChange={(e) => onChange({ ...settings, imapUser: e.target.value })}
              placeholder="kontakt@twojadomena.pl"
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#94A3B8] mb-1">Hasło IMAP</label>
            <input
              type="password"
              value={settings.imapPass}
              onChange={(e) => onChange({ ...settings, imapPass: e.target.value })}
              placeholder={
                settings.hasImapPass
                  ? "•••••••• (pozostaw puste aby nie zmieniać)"
                  : "Wpisz hasło IMAP"
              }
              className="w-full bg-[#0A0E17] border border-[#28354D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
        </div>
      </div>

      {/* API Keys Configuration */}
      <div className="bg-[#141C2E] border border-[#28354D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[#28354D] pb-3">
          <div className="p-2 bg-[#A855F7]/10 text-[#C084FC] rounded-lg">
            <Key size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Klucze Usług Zewnętrznych & Integracje API</h3>
            <p className="text-xs text-[#94A3B8]">Google Places / Maps API, Gemini AI oraz Netlify</p>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* Google Places API */}
          <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🗺️</span> GOOGLE_MAPS_API_KEY (Google Places API New & Legacy)
                </label>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  Wymagany do dynamicznego wyszukiwania przedsiębiorstw, weryfikacji stron WWW, telefonów i geolokalizacji.
                </p>
              </div>
              <button
                type="button"
                onClick={onTestGoogleApi}
                disabled={googleTesting || (!settings.googleApiKey && !settings.hasGoogleApiKey)}
                className="bg-[#1E293B] hover:bg-[#2D3D58] border border-[#FFE600]/40 text-[#FFE600] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={googleTesting ? "animate-spin" : ""} />
                {googleTesting ? "Testowanie klucza..." : "Testuj połączenie Google API"}
              </button>
            </div>

            <input
              type="password"
              value={settings.googleApiKey}
              onChange={(e) => onChange({ ...settings, googleApiKey: e.target.value })}
              placeholder={
                settings.hasGoogleApiKey
                  ? "•••••••• (Klucz aktywny w bazie — wpisz nowy aby zmienić)"
                  : "Wklej klucz Google API (AIzaSy...)"
              }
              className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />

            {googleDiagnostic && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-200 ${
                  googleDiagnostic.success
                    ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
                    : "bg-rose-950/50 border-rose-500/50 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white">
                  {googleDiagnostic.success ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>Klucz Google API aktywny i zweryfikowany!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-rose-400" />
                      <span>Błąd weryfikacji Google API</span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed">{googleDiagnostic.message}</p>
                {googleDiagnostic.hint && (
                  <div className="mt-2 p-2.5 bg-black/40 rounded-lg border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                    <strong className="block mb-0.5 text-white">💡 Wskazówka / Jak naprawić:</strong>
                    {googleDiagnostic.hint}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gemini AI API */}
          <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>✨</span> GEMINI_API_KEY (Google Gemini AI 2.5 Flash)
              </label>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                Wymagane do audytów & ofert
              </span>
            </div>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => onChange({ ...settings, geminiApiKey: e.target.value })}
              placeholder={
                settings.hasGeminiApiKey
                  ? "•••••••• (Klucz aktywny w bazie — wpisz nowy aby zmienić)"
                  : "Wklej klucz Gemini API (AIzaSy...)"
              }
              className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>

          {/* Netlify Auth Token */}
          <div className="p-4 bg-[#0A0E17] border border-[#28354D] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🌐</span> NETLIFY_AUTH_TOKEN
              </label>
              <span className="text-[10px] text-[#94A3B8]">Opcjonalne (hosting stron landing page)</span>
            </div>
            <input
              type="password"
              value={settings.netlifyToken}
              onChange={(e) => onChange({ ...settings, netlifyToken: e.target.value })}
              placeholder={
                settings.hasNetlifyToken
                  ? "•••••••• (skonfigurowano)"
                  : "Wklej token Netlify"
              }
              className="w-full bg-[#141C2E] border border-[#28354D] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE600]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
