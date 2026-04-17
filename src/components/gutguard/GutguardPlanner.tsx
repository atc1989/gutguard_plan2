import Script from "next/script";
import AddMemberModal from "./AddMemberModal";
import Footer from "./Footer";
import FormScreen from "./FormScreen";
import { GutguardActionProvider } from "./GutguardActionContext";
import Header from "./Header";
import HomeScreen from "./HomeScreen";
import { getLegacyClientScripts } from "@/lib/gutguard-utils";
import { gutguardSiteConfig } from "@/lib/gutguard-site-config";

const runtimeEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
};

export default function GutguardPlanner() {
  const legacyClientScripts = getLegacyClientScripts();

  return (
    <GutguardActionProvider>
      <Header />
      <HomeScreen />
      <FormScreen />
      <AddMemberModal />
      <Footer />
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="afterInteractive"
      />
      <Script id="gutguard-runtime-env" strategy="afterInteractive">
        {`window.__GUTGUARD_ENV = ${JSON.stringify(runtimeEnv)};`}
      </Script>
      <Script id="gutguard-site-config" strategy="afterInteractive">
        {`window.__GUTGUARD_SITE_CONFIG = ${JSON.stringify(gutguardSiteConfig)};`}
      </Script>
      {legacyClientScripts.map((script) => (
        <Script
          key={`${script.name}-${script.content.length}`}
          id={`legacy-${script.name}-${script.content.length}`}
          strategy="afterInteractive"
        >
          {script.content}
        </Script>
      ))}
    </GutguardActionProvider>
  );
}
