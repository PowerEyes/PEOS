export type Customer = {
  id: string; customer_code: string; vision_id: string; full_name: string; phone: string; whatsapp: string | null; email: string | null;
  referred_by_doctor: string | null; gender: "male" | "female" | null; dob: string | null; address_line1: string | null;
  referred_by_customer?: string | null;
  address_line2: string | null; landmark: string | null; city: string | null; state: string | null; pincode: string | null;
  notes: string | null; tags: string[]; status: string; created_at: string; whatsapp_opt_in?: boolean | null; whatsapp_opt_in_at?: string | null; };
export const ageFrom = (dob: string | null) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;
