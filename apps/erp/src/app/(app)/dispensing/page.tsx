import { redirect } from "next/navigation";
// Quality checks and hand-over happen on the Workshop board (QC and Ready stages).
export default function Page() { redirect("/workshop"); }
