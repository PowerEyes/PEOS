import { redirect } from "next/navigation";
// The wishlist lives in the customer portal; /wishlist (linked from the header) forwards there.
export default function Page() { redirect("/my/wishlist"); }
