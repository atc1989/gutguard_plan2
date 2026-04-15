import { getLegacyFormMarkup } from "@/lib/gutguard-utils";

const formMarkup = getLegacyFormMarkup();

export default function FormScreen() {
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: formMarkup }} />;
}
