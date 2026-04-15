import Script from "next/script";
import AddMemberModal from "./AddMemberModal";
import FormScreen from "./FormScreen";
import Header from "./Header";
import HomeScreen from "./HomeScreen";
import { legacyClientScriptNames } from "@/lib/gutguard-data";
import { getLegacyFooterMarkup } from "@/lib/gutguard-utils";

const footerMarkup = getLegacyFooterMarkup();

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
      {legacyClientScriptNames.map((scriptName) => (
        <Script key={scriptName} src={`/legacy/${scriptName}`} strategy="afterInteractive" />
      ))}
    </>
  );
}
