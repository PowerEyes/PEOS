import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EyeTestBooking } from "./booking";
export const metadata = { title: "Book an Eye Test – Power Eyes Opticals" };
export default function Page() {
  return <div className="min-h-screen bg-white"><Header/><EyeTestBooking/><Footer/></div>;
}
