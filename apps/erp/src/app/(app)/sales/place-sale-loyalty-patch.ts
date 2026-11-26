
// INTEGRATION PATCH — add this to your existing place_sale server action
// In apps/erp/src/app/(app)/sales/actions.ts, after the sale is placed:
//
// import { awardPurchasePoints, redeemPoints } from "@/lib/loyalty";
//
// After place_sale() returns successfully:
//
//   if (customerId) {
//     // Award points for this purchase
//     await awardPurchasePoints(customerId, saleId, grandTotal);
//     // Redeem points if customer chose to (passed in form data)
//     const loyaltyPoints = Number(fd.get("loyalty_points_redeemed") || 0);
//     const loyaltyDiscount = Number(fd.get("loyalty_discount") || 0);
//     if (loyaltyPoints > 0) {
//       await redeemPoints(customerId, saleId, loyaltyPoints, loyaltyDiscount);
//     }
//   }
//
// In the POS overlay form, add hidden inputs:
//   <input type="hidden" name="loyalty_points_redeemed" value={loyaltyPoints}/>
//   <input type="hidden" name="loyalty_discount" value={loyaltyDiscount}/>
//
// Add state to pos-overlay.tsx:
//   const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
//   const [loyaltyPoints, setLoyaltyPoints] = useState(0);
//
// And subtract loyalty discount from grand total:
//   const grandTotal = subtotal - couponDiscount - loyaltyDiscount;

export const LOYALTY_INTEGRATION_NOTE = "See comments above for integration steps";
