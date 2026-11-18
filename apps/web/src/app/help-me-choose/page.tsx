import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HelpMeChoose } from "./wizard";
export const metadata = { title: "EYES Consultation – Help Me Choose" };
export default function Page() {
  return <div className="min-h-screen bg-white"><Header/><HelpMeChoose/><Footer/></div>;
}
