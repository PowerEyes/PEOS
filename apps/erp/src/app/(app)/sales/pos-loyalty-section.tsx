
"use client";
// Drop this into the POS overlay sidebar, below the customer selector.
// Add to the bottom of the right-side panel in pos-overlay.tsx:
//
//   import { POSLoyaltySection } from "./pos-loyalty-section";
//
//   {selectedCustomer && (
//     <POSLoyaltySection
//       customerId={selectedCustomer.id}
//       billAmount={grandTotal}
//       onRedeemChange={(discount, points) => {
//         setLoyaltyDiscount(discount);
//         setLoyaltyPoints(points);
//       }}/>)}
//
// Then add to place_sale call:
//   After the sale is confirmed, call:
//   await awardPurchasePoints(customerId, saleId, grandTotal);
//   if (loyaltyPoints > 0) await redeemPoints(customerId, saleId, loyaltyPoints, loyaltyDiscount);

import { LoyaltyPOSPanel } from "@/components/LoyaltyPOSPanel";
import { Gift } from "lucide-react";

type Props = {
  customerId:    string;
  billAmount:    number;
  onRedeemChange:(discount: number, points: number) => void;
};

export function POSLoyaltySection({ customerId, billAmount, onRedeemChange }: Props) {
  return (
    <div className="mt-3">
      <LoyaltyPOSPanel
        customerId={customerId}
        billAmount={billAmount}
        onRedeemChange={onRedeemChange}/>
    </div>);
}
