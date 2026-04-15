import { getLegacyAddMemberModalMarkup } from "@/lib/gutguard-utils";

const addMemberModalMarkup = getLegacyAddMemberModalMarkup();

export default function AddMemberModal() {
  return (
    <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: addMemberModalMarkup }} />
  );
}
