import Script from "next/script";
import AddMemberModal from "./AddMemberModal";
import FormScreen from "./FormScreen";
import Header from "./Header";
import HomeScreen from "./HomeScreen";
import { getLegacyClientScripts, getLegacyFooterMarkup } from "@/lib/gutguard-utils";

const footerMarkup = getLegacyFooterMarkup();
const legacyClientScripts = getLegacyClientScripts();
const runtimeEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
};

export default function GutguardPlanner() {
  return (
    <>
      <Header />
      <HomeScreen />
      <FormScreen />
      <AddMemberModal />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: footerMarkup }} />
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="afterInteractive"
      />
      <Script id="gutguard-runtime-env" strategy="afterInteractive">
        {`window.__GUTGUARD_ENV = ${JSON.stringify(runtimeEnv)};`}
      </Script>
      {legacyClientScripts.map((script) => (
        <Script key={script.name} id={`legacy-${script.name}`} strategy="afterInteractive">
          {script.content}
        </Script>
      ))}
    </>
  );
}
