export type Product = { id:string;kind:string;sku:string;brand:string|null;model:string;collection:string|null;gender:string;selling_price:number;mrp:number|null;power_eligible:boolean;featured:boolean;new_arrival:boolean;bestseller:boolean;short_desc:string|null;description:string|null;images:string[];attrs:Record<string,any>;in_stock:boolean;stock_qty?:number;today_views?:number; };
export const imgUrl = (p:string|undefined) => p?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${p}`:null;
/** Public URL for a CMS image in the `site-images` bucket (0023). Null → null so callers keep their emoji/gradient fallback. */
export const siteImgUrl = (p?:string|null) => p?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${p}`:null;
export const inr = (n:number|null|undefined) => n==null?"":`₹${Number(n).toLocaleString("en-IN")}`;
export const disc = (mrp:number|null,sell:number) => mrp&&mrp>sell?Math.round(((mrp-sell)/mrp)*100):null;
export const SHAPES = ["Round","Square","Rectangle","Cat Eye","Aviator","Geometric","Browline","Oval"];
export const LENS_TYPES = [
  {key:"blue_light",label:"Blue Light",desc:"For screen & work",color:"from-blue-900 to-blue-700"},
  {key:"progressive",label:"Progressive",desc:"All distances, one lens",color:"from-teal-800 to-teal-600"},
  {key:"driving",label:"Driving",desc:"Clearer & safer nights",color:"from-slate-800 to-slate-700"},
  {key:"photochromic",label:"Photochromic",desc:"Indoor to outdoor",color:"from-amber-800 to-amber-600"},
  {key:"high_power",label:"High Power",desc:"Expert solutions",color:"from-navy-800 to-navy-700"},
  {key:"kids",label:"Kids Lenses",desc:"Tough & safe",color:"from-emerald-800 to-emerald-600"},
];
export const LIFESTYLE = [{l:"Office",e:"💼"},{l:"Computer",e:"💻"},{l:"Driving",e:"🚗"},{l:"Travel",e:"✈️"},{l:"Sports",e:"⚽"},{l:"Everyday",e:"☀️"},{l:"Kids",e:"🎒"},{l:"Premium",e:"⭐"}];
