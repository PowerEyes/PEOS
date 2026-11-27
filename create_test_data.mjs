import { Pool } from 'pg';

if (process.env.ALLOW_RLS_OFF_SCRIPTS !== "1") {
  throw new Error("RLS-off diagnostics are retired; use an isolated staging database only.");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: DATABASE_URL });

const ORG_ID = 'aa4fd022-272b-4d96-80cc-9005ad7313ad';
const BRANCH_MAIN = '4055cd6f-c715-4a4a-88c7-be628d0166b1';
const BRANCH_WEST = 'ed1aa618-9046-4021-9f03-2f62630a1558';
const BRANCHES = [BRANCH_MAIN, BRANCH_WEST];
const OWNER_UID = 'a8d9238e-2711-46ee-84bf-52f57ff08425';

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Sai', 'Arjun', 'Krishna', 'Ishaan', 'Rudra', 'Shaurya',
  'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Myra', 'Priya', 'Kavya', 'Navya', 'Riya', 'Anika',
  'Rohan', 'Kabir', 'Ayaan', 'Dhruv', 'Reyansh', 'Aarush', 'Kiaan', 'Vihan', 'Atharv', 'Samarth',
  'Meera', 'Ishita', 'Sia', 'Avni', 'Kiara', 'Zoya', 'Naira', 'Aisha', 'Tara', 'Sara',
  'Vikram', 'Varun', 'Siddharth', 'Karthik', 'Rohan', 'Manish', 'Rajesh', 'Suresh', 'Mahesh', 'Ramesh',
  'Pooja', 'Neha', 'Kavita', 'Sunita', 'Geeta', 'Laxmi', 'Saraswati', 'Durga', 'Parvati', 'Radha',
  'Amit', 'Sumit', 'Rajiv', 'Sanjay', 'Prakash', 'Vinod', 'Manoj', 'Dinesh', 'Rakesh', 'Sunil',
  'Seema', 'Rekha', 'Asha', 'Usha', 'Kiran', 'Jyoti', 'Rani', 'Laxmi', 'Maya', 'Kamla',
  'Rahul', 'Mohit', 'Nitin', 'Sachin', 'Vipul', 'Ajay', 'Sanjay', 'Vijay', 'Ajit', 'Rajiv',
  'Anjali', 'Divya', 'Poonam', 'Swati', 'Ritu', 'Shalini', 'Megha', 'Pallavi', 'Sneha', 'Deepika'];

const lastNames = ['Sharma', 'Verma', 'Singh', 'Gupta', 'Agarwal', 'Jain', 'Kumar', 'Rao', 'Reddy', 'Nair',
  'Iyer', 'Pillai', 'Menon', 'Gowda', 'Patel', 'Desai', 'Joshi', 'Trivedi', 'Shukla', 'Tripathi',
  'Mishra', 'Pandey', 'Dubey', 'Chaturvedi', 'Saxena', 'Mehrotra', 'Kulkarni', 'Deshpande', 'Kamat', 'Bhat',
  'Kulkarni', 'Kini', 'Prabhu', 'Shenoy', 'Rao', 'Naidu', 'Reddy', 'Varma', 'Raju', 'Babu'];

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad',
  'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam'];

const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat', 'Rajasthan'];

const brands = [
  { name: 'VisionCraft', manufacturer_status: 'unverified' },
  { name: 'SunShield', manufacturer_status: 'unverified' },
  { name: 'ClearView', manufacturer_status: 'unverified' },
  { name: 'OptiCare', manufacturer_status: 'unverified' },
  { name: 'Luxottica', manufacturer_status: 'unverified' },
  { name: 'Essilor', manufacturer_status: 'unverified' },
  { name: 'Carl Zeiss', manufacturer_status: 'unverified' },
  { name: 'Hoya', manufacturer_status: 'unverified' },
  { name: 'Ray-Ban', manufacturer_status: 'unverified' },
  { name: 'Oakley', manufacturer_status: 'unverified' },
];

const suppliers = [
  { name: 'VisionCraft Opticals Pvt Ltd', contact_person: 'Rajesh Sharma', phone: '+91 98765 01001', email: 'orders@visioncraft.co.in', gstin: '27AABCV1234C1Z5', state: 'Maharashtra', address: '123 Industrial Estate, Andheri East, Mumbai 400069' },
  { name: 'SunShield Eyewear Co', contact_person: 'Priya Verma', phone: '+91 98765 01002', email: 'sales@sunshield.in', gstin: '29AABCS5678D1Z8', state: 'Karnataka', address: '45 Electronic City, Bangalore 560100' },
  { name: 'ClearView Contact Lenses', contact_person: 'Amit Gupta', phone: '+91 98765 01003', email: 'info@clearview.in', gstin: '07AABCK9012E1Z1', state: 'Delhi', address: '78 Nehru Place, New Delhi 110019' },
  { name: 'OptiCare Supplies', contact_person: 'Suresh Agarwal', phone: '+91 98765 01004', email: 'supply@opticare.co.in', gstin: '33AABCO3456F1Z2', state: 'Tamil Nadu', address: '34 T Nagar, Chennai 600017' },
  { name: 'Luxottica India', contact_person: 'Kavita Jain', phone: '+91 98765 01005', email: 'b2b@luxottica.in', gstin: '23AABCL7890G1Z3', state: 'Maharashtra', address: '56 MIDC, Pune 411018' },
  { name: 'Essilor India Pvt Ltd', contact_person: 'Ramesh Kumar', phone: '+91 98765 01006', email: 'orders@essilor.in', gstin: '09AABCE1234H1Z4', state: 'Uttar Pradesh', address: '67 Sector 62, Noida 201301' },
  { name: 'Carl Zeiss Vision', contact_person: 'Anita Reddy', phone: '+91 98765 01007', email: 'vision@zeiss.in', gstin: '36AABCZ5678I1Z5', state: 'Telangana', address: '89 Hitech City, Hyderabad 500081' },
  { name: 'Hoya Lens India', contact_person: 'Deepak Nair', phone: '+91 98765 01008', email: 'sales@hoya.co.in', gstin: '19AABCH9012J1Z6', state: 'West Bengal', address: '12 Salt Lake, Kolkata 700091' },
  { name: 'Ray-Ban India', contact_person: 'Sunita Desai', phone: '+91 98765 01009', email: 'wholesale@rayban.in', gstin: '24AABCR3456K1Z7', state: 'Gujarat', address: '45 SG Highway, Ahmedabad 380015' },
  { name: 'Oakley Sports Eyewear', contact_person: 'Vikram Iyer', phone: '+91 98765 01010', email: 'orders@oakley.in', gstin: '25AABCO7890L1Z8', state: 'Maharashtra', address: '78 BKC, Mumbai 400051' },
  { name: 'Titan Eyeplus', contact_person: 'Laxmi Pillai', phone: '+91 98765 01011', email: 'b2b@titan.co.in', gstin: '27AAABT1234M1Z9', state: 'Maharashtra', address: '23 Churchgate, Mumbai 400020' },
  { name: 'Lenskart Wholesale', contact_person: 'Ravi Menon', phone: '+91 98765 01012', email: 'wholesale@lenskart.in', gstin: '07AAABC5678N1Z0', state: 'Delhi', address: '56 Connaught Place, Delhi 110001' },
  { name: 'GKB Opticals', contact_person: 'Sunita Gowda', phone: '+91 98765 01013', email: 'orders@gkb.in', gstin: '29AAABC9012O1Z1', state: 'Karnataka', address: '34 MG Road, Bangalore 560001' },
  { name: 'John Jacobs Eyewear', contact_person: 'Rajesh Patel', phone: '+91 98765 01014', email: 'supply@johnjacobs.in', gstin: '24AAABC3456P1Z2', state: 'Gujarat', address: '78 CG Road, Ahmedabad 380009' },
  { name: 'Vincent Chase', contact_person: 'Pooja Trivedi', phone: '+91 98765 01015', email: 'orders@vincentchase.in', gstin: '27AAABC7890Q1Z3', state: 'Maharashtra', address: '45 Lower Parel, Mumbai 400013' },
  { name: 'Fastrack Eyewear', contact_person: 'Karthik Shukla', phone: '+91 98765 01016', email: 'b2b@fastrack.in', gstin: '07AAABC1234R1Z4', state: 'Delhi', address: '67 Nehru Place, Delhi 110019' },
  { name: 'Coolwinks', contact_person: 'Megha Mishra', phone: '+91 98765 01017', email: 'supply@coolwinks.in', gstin: '23AAABC5678S1Z5', state: 'Maharashtra', address: '45 Andheri West, Mumbai 400058' },
  { name: 'EyeMyEye', contact_person: 'Rahul Pandey', phone: '+91 98765 01018', email: 'orders@eyemyeye.in', gstin: '09AAABC9012T1Z6', state: 'Uttar Pradesh', address: '34 Gomti Nagar, Lucknow 226010' },
  { name: 'Specsmakers', contact_person: 'Divya Dubey', phone: '+91 98765 01019', email: 'b2b@specsmakers.in', gstin: '36AAABC3456U1Z7', state: 'Telangana', address: '56 Jubilee Hills, Hyderabad 500033' },
  { name: 'Titan Eye Plus Wholesale', contact_person: 'Sneha Chaturvedi', phone: '+91 98765 01020', email: 'wholesale@titan.co.in', gstin: '27AAABC7890V1Z8', state: 'Maharashtra', address: '12 Fort, Mumbai 400001' },
  { name: 'Optical World', contact_person: 'Deepika Saxena', phone: '+91 98765 01021', email: 'orders@opticalworld.in', gstin: '19AAABC1234W1Z9', state: 'West Bengal', address: '78 Park Street, Kolkata 700016' },
  { name: 'Vision Express India', contact_person: 'Kiran Mehrotra', phone: '+91 98765 01022', email: 'supply@visionexpress.in', gstin: '24AAABC5678X1Z0', state: 'Gujarat', address: '45 Navrangpura, Ahmedabad 380009' },
  { name: 'Lenskart Opticals', contact_person: 'Swati Kulkarni', phone: '+91 98765 01023', email: 'orders@lenskart.in', gstin: '07AAABC9012Y1Z1', state: 'Delhi', address: '67 Saket, Delhi 110017' },
  { name: 'Titan Eyex', contact_person: 'Ritu Deshpande', phone: '+91 98765 01024', email: 'b2b@titan.in', gstin: '29AAABC1234Z1Z2', state: 'Karnataka', address: '89 Whitefield, Bangalore 560066' },
  { name: 'Bausch Lomb India', contact_person: 'Pallavi Kamat', phone: '+91 98765 01025', email: 'orders@bausch.com', gstin: '23AAABC5678AA1Z3', state: 'Maharashtra', address: '34 MIDC, Pune 411026' },
  { name: 'Alcon Vision Care', contact_person: 'Shalini Bhat', phone: '+91 98765 01026', email: 'supply@alcon.in', gstin: '25AABCD9012BB1Z4', state: 'Maharashtra', address: '56 Andheri East, Mumbai 400093' },
  { name: 'CooperVision India', contact_person: 'Megha Prabhu', phone: '+91 98765 01027', email: 'orders@coopervision.in', gstin: '27AAABC3456CC1Z5', state: 'Maharashtra', address: '78 BKC Annex, Mumbai 400051' },
  { name: 'Johnson & Johnson Vision', contact_person: 'Deepika Shenoy', phone: '+91 98765 01028', email: 'b2b@jnjvision.com', gstin: '09AAABC7890DD1Z6', state: 'Delhi', address: '45 Okhla, New Delhi 110020' },
  { name: 'Menicon India', contact_person: 'Laxmi Rao', phone: '+91 98765 01029', email: 'orders@menicon.in', gstin: '36AAABC1234EE1Z7', state: 'Telangana', address: '89 Gachibowli, Hyderabad 500032' },
  { name: 'SEED Contact Lenses', contact_person: 'Rajesh Naidu', phone: '+91 98765 01030', email: 'supply@seed.in', gstin: '24AAABC5678FF1Z8', state: 'Gujarat', address: '12 Satellite, Ahmedabad 380015' },
];

const products = [
  { kind: 'frame', brand: 'VisionCraft', model: 'Classic Round Black', sku: 'VC-FRM-001', gender: 'unisex', mrp: 2499, selling_price: 1999, tax_pct: 5, cost_price: 900, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'VisionCraft', model: 'Metal Rectangle Silver', sku: 'VC-FRM-002', gender: 'men', mrp: 2999, selling_price: 2399, tax_pct: 5, cost_price: 1120, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'VisionCraft', model: 'Lightweight Oval Rose', sku: 'VC-FRM-003', gender: 'women', mrp: 3299, selling_price: 2699, tax_pct: 5, cost_price: 1250, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'VisionCraft', model: 'Wayfarer Tortoise', sku: 'VC-FRM-004', gender: 'unisex', mrp: 2799, selling_price: 2299, tax_pct: 5, cost_price: 1050, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'VisionCraft', model: 'Aviator Metal Gold', sku: 'VC-FRM-005', gender: 'men', mrp: 3499, selling_price: 2999, tax_pct: 5, cost_price: 1400, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'VisionCraft', model: 'Cat Eye Acetate', sku: 'VC-FRM-006', gender: 'women', mrp: 3199, selling_price: 2699, tax_pct: 5, cost_price: 1300, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'UrbanLook', model: 'Sporty Wrap Black', sku: 'UL-FRM-001', gender: 'unisex', mrp: 1999, selling_price: 1599, tax_pct: 5, cost_price: 750, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'UrbanLook', model: 'Office Rectangle Grey', sku: 'UL-FRM-002', gender: 'men', mrp: 2199, selling_price: 1799, tax_pct: 5, cost_price: 850, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'UrbanLook', model: 'Fashion Cat Eye Pink', sku: 'UL-FRM-003', gender: 'women', mrp: 2499, selling_price: 1999, tax_pct: 5, cost_price: 950, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'UrbanLook', model: 'Kids Flexi Blue', sku: 'UL-FRM-004', gender: 'kids', mrp: 1499, selling_price: 1199, tax_pct: 5, cost_price: 600, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'Luxottica', model: 'Premium Titanium Black', sku: 'LUX-FRM-001', gender: 'unisex', mrp: 8999, selling_price: 7499, tax_pct: 5, cost_price: 4200, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'Luxottica', model: 'Designer Square Brown', sku: 'LUX-FRM-002', gender: 'women', mrp: 9499, selling_price: 7999, tax_pct: 5, cost_price: 4500, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'Ray-Ban', model: 'Classic Wayfarer Black', sku: 'RB-FRM-001', gender: 'unisex', mrp: 5999, selling_price: 4999, tax_pct: 5, cost_price: 2800, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'Ray-Ban', model: 'Clubmaster Tortoise', sku: 'RB-FRM-002', gender: 'men', mrp: 6499, selling_price: 5499, tax_pct: 5, cost_price: 3100, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'John Jacobs', model: 'Trendy Round Blue', sku: 'JJ-FRM-001', gender: 'unisex', mrp: 2699, selling_price: 2199, tax_pct: 5, cost_price: 1100, power_eligible: true, hsn: '900319' },
  { kind: 'frame', brand: 'John Jacobs', model: 'Oval Gradient Pink', sku: 'JJ-FRM-002', gender: 'women', mrp: 2899, selling_price: 2399, tax_pct: 5, cost_price: 1200, power_eligible: true, hsn: '900319' },
  { kind: 'sunglass', brand: 'SunShield', model: 'Aviator Gold Green', sku: 'SS-SUN-001', gender: 'unisex', mrp: 3499, selling_price: 2799, tax_pct: 5, cost_price: 1320, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'SunShield', model: 'Wayfarer Black Polarized', sku: 'SS-SUN-002', gender: 'men', mrp: 3999, selling_price: 3199, tax_pct: 5, cost_price: 1550, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'SunShield', model: 'Cat Eye Tortoise', sku: 'SS-SUN-003', gender: 'women', mrp: 3799, selling_price: 2999, tax_pct: 5, cost_price: 1440, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'SunShield', model: 'Sport Wrap Blue', sku: 'SS-SUN-004', gender: 'unisex', mrp: 2999, selling_price: 2399, tax_pct: 5, cost_price: 1150, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'SunShield', model: 'Round John Lennon', sku: 'SS-SUN-005', gender: 'unisex', mrp: 2699, selling_price: 2199, tax_pct: 5, cost_price: 1050, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'Oakley', model: 'Holbrook Matte Black', sku: 'OK-SUN-001', gender: 'men', mrp: 12999, selling_price: 10999, tax_pct: 5, cost_price: 6200, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'Oakley', model: 'Frogskins Prizm', sku: 'OK-SUN-002', gender: 'unisex', mrp: 11499, selling_price: 9499, tax_pct: 5, cost_price: 5400, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'Ray-Ban', model: 'Aviator Gold', sku: 'RB-SUN-001', gender: 'unisex', mrp: 8999, selling_price: 7499, tax_pct: 5, cost_price: 4200, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'Ray-Ban', model: 'Clubmaster Classic', sku: 'RB-SUN-002', gender: 'unisex', mrp: 9499, selling_price: 7999, tax_pct: 5, cost_price: 4500, power_eligible: false, hsn: '900410' },
  { kind: 'sunglass', brand: 'Fastrack', model: 'Sporty Shield Black', sku: 'FT-SUN-001', gender: 'unisex', mrp: 1999, selling_price: 1599, tax_pct: 5, cost_price: 750, power_eligible: false, hsn: '900410' },
  { kind: 'contact_lens', brand: 'ClearView', model: 'Monthly Clear 3 Pack', sku: 'CV-CL-001', gender: 'unisex', mrp: 999, selling_price: 799, tax_pct: 12, cost_price: 390, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'ClearView', model: 'Daily Comfort 30 Pack', sku: 'CV-CL-002', gender: 'unisex', mrp: 1899, selling_price: 1599, tax_pct: 12, cost_price: 820, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'ClearView', model: 'Monthly Toric 3 Pack', sku: 'CV-CL-003', gender: 'unisex', mrp: 1599, selling_price: 1299, tax_pct: 12, cost_price: 640, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'ClearView', model: 'Daily Toric 30 Pack', sku: 'CV-CL-004', gender: 'unisex', mrp: 2099, selling_price: 1799, tax_pct: 12, cost_price: 880, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'ClearView', model: 'Monthly Multifocal 3 Pack', sku: 'CV-CL-005', gender: 'unisex', mrp: 2499, selling_price: 2099, tax_pct: 12, cost_price: 1050, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'Bausch Lomb', model: 'Ultra Monthly 6 Pack', sku: 'BL-CL-001', gender: 'unisex', mrp: 2999, selling_price: 2499, tax_pct: 12, cost_price: 1400, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'Bausch Lomb', model: 'Infiniti Daily 30 Pack', sku: 'BL-CL-002', gender: 'unisex', mrp: 2499, selling_price: 1999, tax_pct: 12, cost_price: 1100, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'Alcon', model: 'Dailies Total1 30 Pack', sku: 'ALC-CL-001', gender: 'unisex', mrp: 3499, selling_price: 2999, tax_pct: 12, cost_price: 1800, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'Alcon', model: 'Air Optix Colors 2 Pack', sku: 'ALC-CL-002', gender: 'unisex', mrp: 2799, selling_price: 2299, tax_pct: 12, cost_price: 1400, power_eligible: false, hsn: '900161' },
  { kind: 'contact_lens', brand: 'CooperVision', model: 'Biofinity Monthly 6 Pack', sku: 'COOP-CL-001', gender: 'unisex', mrp: 3199, selling_price: 2699, tax_pct: 12, cost_price: 1600, power_eligible: false, hsn: '900161' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Microfiber Cleaning Kit', sku: 'OC-ACC-001', gender: 'unisex', mrp: 299, selling_price: 199, tax_pct: 18, cost_price: 65, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Hard Case Navy', sku: 'OC-ACC-002', gender: 'unisex', mrp: 399, selling_price: 249, tax_pct: 18, cost_price: 90, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Anti Fog Lens Spray', sku: 'OC-ACC-003', gender: 'unisex', mrp: 349, selling_price: 229, tax_pct: 18, cost_price: 80, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Lens Cleaning Wipes Box', sku: 'OC-ACC-004', gender: 'unisex', mrp: 199, selling_price: 129, tax_pct: 18, cost_price: 50, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Eyeglass Repair Kit', sku: 'OC-ACC-005', gender: 'unisex', mrp: 249, selling_price: 179, tax_pct: 18, cost_price: 70, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Nose Pads Pack', sku: 'OC-ACC-006', gender: 'unisex', mrp: 149, selling_price: 99, tax_pct: 18, cost_price: 40, power_eligible: false, hsn: '900319' },
  { kind: 'accessory', brand: 'OptiCare', model: 'Temple Tips Silicone', sku: 'OC-ACC-007', gender: 'unisex', mrp: 199, selling_price: 149, tax_pct: 18, cost_price: 60, power_eligible: false, hsn: '900319' },
];

const lensPackages = [
  { code: 'LP-SV-1.56', name: 'Single Vision 1.56 Index', design: 'single_vision', segment: 'distance', base_price: 999, mrp: 1499, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant'], indexes: ['1.56'], coatings: ['ar', 'hc'], sph_min: -10.0, sph_max: 10.0, cyl_max: 4.0, status: 'active' },
  { code: 'LP-SV-1.61', name: 'Single Vision 1.61 Index', design: 'single_vision', segment: 'distance', base_price: 1499, mrp: 2199, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant', 'uv_protection'], indexes: ['1.61'], coatings: ['ar', 'hc', 'blue'], sph_min: -12.0, sph_max: 12.0, cyl_max: 6.0, status: 'active' },
  { code: 'LP-SV-1.67', name: 'Single Vision 1.67 Index', design: 'single_vision', segment: 'distance', base_price: 2199, mrp: 3199, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant', 'uv_protection', 'thin_light'], indexes: ['1.67'], coatings: ['ar', 'hc', 'blue', 'hydrophobic'], sph_min: -16.0, sph_max: 16.0, cyl_max: 8.0, status: 'active' },
  { code: 'LP-PROG-1.60', name: 'Progressive 1.60 Index', design: 'progressive', segment: 'progressive', base_price: 4999, mrp: 7499, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant', 'uv_protection', 'progressive'], indexes: ['1.60'], coatings: ['ar', 'hc', 'blue'], sph_min: -10.0, sph_max: 10.0, cyl_max: 4.0, status: 'active', min_add: 1.0, max_add: 3.5 },
  { code: 'LP-PROG-1.67', name: 'Progressive 1.67 Index', design: 'progressive', segment: 'progressive', base_price: 6999, mrp: 10499, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant', 'uv_protection', 'thin_light', 'progressive'], indexes: ['1.67'], coatings: ['ar', 'hc', 'blue', 'hydrophobic'], sph_min: -14.0, sph_max: 14.0, cyl_max: 6.0, status: 'active', min_add: 1.0, max_add: 3.5 },
  { code: 'LP-BIF-1.56', name: 'Bifocal 1.56 Index', design: 'bifocal', segment: 'near_distance', base_price: 2499, mrp: 3699, tax_pct: 12, features: ['anti_reflective', 'scratch_resistant'], indexes: ['1.56'], coatings: ['ar', 'hc'], sph_min: -10.0, sph_max: 10.0, cyl_max: 4.0, status: 'active' },
];

const lensOptions = [
  { grp: 'index', code: 'idx-1.56', name: '1.56 Index', description: 'Standard index lens', price: 0, tax_pct: 12, designs: ['single_vision', 'bifocal'], status: 'active' },
  { grp: 'index', code: 'idx-1.61', name: '1.61 Index', description: 'Thin & light index', price: 500, tax_pct: 12, designs: ['single_vision'], status: 'active' },
  { grp: 'index', code: 'idx-1.67', name: '1.67 Index', description: 'Super thin index', price: 1200, tax_pct: 12, designs: ['single_vision', 'progressive'], status: 'active' },
  { grp: 'addon', code: 'add-ar', name: 'Anti-Reflective Coating', description: 'AR coating for glare reduction', price: 300, tax_pct: 12, designs: [], status: 'active' },
  { grp: 'addon', code: 'add-blue', name: 'Blue Cut Coating', description: 'Blue light filter coating', price: 400, tax_pct: 12, designs: [], status: 'active' },
  { grp: 'addon', code: 'add-hc', name: 'Hard Coating', description: 'Scratch resistant hard coating', price: 200, tax_pct: 12, designs: [], status: 'active' },
  { grp: 'addon', code: 'add-hydro', name: 'Hydrophobic Coating', description: 'Water repellent coating', price: 350, tax_pct: 12, designs: [], status: 'active' },
  { grp: 'addon', code: 'add-tint-gray', name: 'Gray Tint', description: 'Gray sun tint', price: 250, tax_pct: 12, designs: [], status: 'active' },
  { grp: 'addon', code: 'add-tint-brown', name: 'Brown Tint', description: 'Brown sun tint', price: 250, tax_pct: 12, designs: [], status: 'active' },
];

(async () => {
  const client = await pool.connect();
  try {
    // Disable RLS and set auth context for this session
    await client.query("SET row_security = off");
    await client.query(`SET auth.uid = '${OWNER_UID}'`);
    
    const results = { brands: 0, suppliers: 0, products: 0, lensPackages: 0, lensOptions: 0, stock: 0 };
    
    // ── 1. Brands ──
    console.log('Creating brands...');
    for (const b of brands) {
      const res = await client.query(
        `INSERT INTO brands (org_id, name, manufacturer_status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
        [ORG_ID, b.name, b.manufacturer_status]
      );
      if (res.rowCount > 0) results.brands++;
    }
    console.log(`Brands created: ${results.brands}`);
    
    // ── 2. Suppliers ──
    console.log('Creating suppliers...');
    for (const s of suppliers) {
      const res = await client.query(
        `INSERT INTO suppliers (org_id, name, contact_person, phone, email, gstin, state, address, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active') ON CONFLICT DO NOTHING RETURNING id`,
        [ORG_ID, s.name, s.contact_person, s.phone, s.email, s.gstin, s.state, s.address]
      );
      if (res.rowCount > 0) results.suppliers++;
    }
    console.log(`Suppliers created: ${results.suppliers}`);
    
    // ── 3. Products ──
    console.log('Creating products...');
    const brandMap = new Map();
    const { rows: brandRows } = await client.query("SELECT id, name FROM brands WHERE org_id = $1", [ORG_ID]);
    brandRows.forEach(b => brandMap.set(b.name, b.id));
    
    const skuSet = new Set();
    for (const p of products) {
      if (skuSet.has(p.sku)) continue;
      skuSet.add(p.sku);
      const brandId = brandMap.get(p.brand) ?? null;
      const ins = await client.query(
        `INSERT INTO products (org_id, kind, sku, brand_id, model, gender, mrp, selling_price, tax_pct, power_eligible, status, hsn, price_mode, visible_on_website)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, 'inclusive', true)
         ON CONFLICT (org_id, sku) DO NOTHING RETURNING id`,
        [ORG_ID, p.kind, p.sku, brandId, p.model, p.gender, p.mrp, p.selling_price, p.tax_pct, p.power_eligible, p.hsn]
      );
      if (ins.rowCount > 0) {
        results.products++;
        await client.query(
          `INSERT INTO product_costs (product_id, org_id, cost_price) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [ins.rows[0].id, ORG_ID, p.cost_price]
        );
      } else {
        // Product may already exist from previous run - try to add cost price
        const existing = await client.query(
          `SELECT id FROM products WHERE org_id = $1 AND sku = $2`,
          [ORG_ID, p.sku]
        );
        if (existing.rowCount > 0) {
          await client.query(
            `INSERT INTO product_costs (product_id, org_id, cost_price) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [existing.rows[0].id, ORG_ID, p.cost_price]
          );
        } else {
          console.error(`Product error ${p.sku}: no row returned`);
        }
      }
    }
    console.log(`Products created: ${results.products}`);
    
    // ── 4. Lens Packages ──
    console.log('Creating lens packages...');
    for (const lp of lensPackages) {
      const res = await client.query(
        `INSERT INTO lens_packages (org_id, code, name, design, segment, base_price, mrp, tax_pct, features, indexes, coatings, sph_min, sph_max, cyl_max, status, min_add, max_add)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', $15, $16) ON CONFLICT DO NOTHING RETURNING id`,
        [ORG_ID, lp.code, lp.name, lp.design, lp.segment, lp.base_price, lp.mrp, lp.tax_pct, lp.features, lp.indexes, lp.coatings, lp.sph_min, lp.sph_max, lp.cyl_max, lp.min_add, lp.max_add]
      );
      if (res.rowCount > 0) results.lensPackages++;
    }
    console.log(`Lens packages created: ${results.lensPackages}`);
    
    // ── 5. Lens Options ──
    console.log('Creating lens options...');
    for (const lo of lensOptions) {
      const res = await client.query(
        `INSERT INTO lens_options (org_id, grp, code, name, description, price, tax_pct, designs, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active') ON CONFLICT DO NOTHING RETURNING id`,
        [ORG_ID, lo.grp, lo.code, lo.name, lo.description, lo.price, lo.tax_pct, lo.designs]
      );
      if (res.rowCount > 0) results.lensOptions++;
    }
    console.log(`Lens options created: ${results.lensOptions}`);
    
    // ── 6. Stock ──
    console.log('Creating stock...');
    await client.query("DELETE FROM stock WHERE org_id = $1", [ORG_ID]);
    await client.query("DELETE FROM stock_movements WHERE org_id = $1 AND reason = 'opening'", [ORG_ID]);
    
    const { rows: productRows } = await client.query("SELECT id, kind, sku FROM products WHERE org_id = $1 AND status = 'active'", [ORG_ID]);
    
    let stockCount = 0;
    for (const branch of BRANCHES) {
      for (const prod of productRows) {
        const res = await client.query(
          `INSERT INTO stock (org_id, branch_id, product_id, qty, reorder_level, reserved_qty)
           VALUES ($1, $2, $3, 1000, 50, 0)`,
          [ORG_ID, branch, prod.id]
        );
        if (res.rowCount > 0) {
          stockCount++;
          await client.query(
            `INSERT INTO stock_movements (org_id, branch_id, product_id, delta, reason, note)
             VALUES ($1, $2, $3, 1000, 'opening', 'Opening stock entry')`,
            [ORG_ID, branch, prod.id]
          );
        }
      }
    }
    results.stock = stockCount;
    console.log(`Stock entries created: ${results.stock} (${productRows.length} products × ${BRANCHES.length} branches)`);
    
    // ── 7. Customers ──
    console.log('Creating customers...');
    const customerCount = 150;
    let custCreated = 0;
    const usedPhones = new Set();
    const usedEmails = new Set();
    
    for (let i = 0; i < customerCount; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fn} ${ln}`;
      
      let phone;
      do {
        phone = '+91 9' + Math.floor(100000000 + Math.random() * 900000000).toString();
      } while (usedPhones.has(phone));
      usedPhones.add(phone);
      
      let email;
      do {
        email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;
      } while (usedEmails.has(email));
      usedEmails.add(email);
      
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const dobYear = 1960 + Math.floor(Math.random() * 45);
      const dobMonth = 1 + Math.floor(Math.random() * 12);
      const dobDay = 1 + Math.floor(Math.random() * 28);
      const dob = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
      const city = cities[Math.floor(Math.random() * cities.length)];
      const state = states[Math.floor(Math.random() * states.length)];
      const pincode = String(100000 + Math.floor(Math.random() * 900000));
      
      const res = await client.query(
        `INSERT INTO customers (org_id, branch_id, full_name, phone, whatsapp, email, gender, dob, address_line1, city, state, pincode, status, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', '{}') RETURNING id`,
        [ORG_ID, BRANCH_MAIN, fullName, phone, phone, email, gender, dob, `${100 + i} Main Street`, city, state, pincode]
      );
      if (res.rowCount > 0) custCreated++;
    }
    console.log(`Customers created: ${custCreated}`);
    
    // ── 8. Prescriptions ──
    console.log('Creating prescriptions...');
    const { rows: customerRows } = await client.query("SELECT id FROM customers WHERE org_id = $1 LIMIT 150", [ORG_ID]);
    const { rows: staffRows } = await client.query("SELECT id FROM profiles WHERE org_id = $1 AND role_key = 'optometrist' LIMIT 5", [ORG_ID]);
    
    const rxTypes = ['Spectacle', 'Contact Lens', 'Sunglass Rx'];
    const purposes = ['Distance', 'Near', 'Distance & Near'];
    const statuses = ['active', 'expired', 'active', 'active', 'expiring_soon'];
    
    let rxCreated = 0;
    const now = new Date();
    
    for (let i = 0; i < 300; i++) {
      const customer = customerRows[Math.floor(Math.random() * customerRows.length)];
      const examinedBy = staffRows.length > 0 ? staffRows[Math.floor(Math.random() * staffRows.length)].id : null;
      
      const rxDate = new Date(now.getTime() - Math.random() * 730 * 24 * 60 * 60 * 1000);
      
      let status, validTill;
      const statusRoll = Math.random();
      if (statusRoll < 0.45) {
        status = 'active';
        validTill = new Date(now.getTime() + (30 + Math.random() * 700) * 24 * 60 * 60 * 1000);
      } else if (statusRoll < 0.65) {
        status = 'active';
        validTill = new Date(now.getTime() + (5 + Math.random() * 25) * 24 * 60 * 60 * 1000);
      } else if (statusRoll < 0.80) {
        status = 'expired';
        validTill = new Date(now.getTime() - (1 + Math.random() * 365) * 24 * 60 * 60 * 1000);
      } else {
        status = 'active';
        validTill = new Date(now.getTime() + (30 + Math.random() * 700) * 24 * 60 * 60 * 1000);
      }
      
      const rxType = rxTypes[Math.floor(Math.random() * rxTypes.length)];
      const purpose = purposes[Math.floor(Math.random() * purposes.length)];
      
      const odSph = (Math.random() * 12 - 6).toFixed(2);
      const odCyl = (Math.random() * 4).toFixed(2);
      const odAxis = Math.floor(Math.random() * 180);
      const osSph = (Math.random() * 12 - 6).toFixed(2);
      const osCyl = (Math.random() * 4).toFixed(2);
      const osAxis = Math.floor(Math.random() * 180);
      const odAdd = Math.random() > 0.5 ? (Math.random() * 3 + 0.5).toFixed(2) : null;
      const osAdd = odAdd;
      
      const res = await client.query(
        `INSERT INTO prescriptions (org_id, branch_id, customer_id, rx_code, rx_date, valid_till, examined_by, rx_type, purpose,
           od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add, pd_far, status, source, review_status, cylinder_convention)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`,
        [ORG_ID, BRANCH_MAIN, customer.id, `RX-${String(1000 + i).padStart(4, '0')}`, rxDate, validTill, examinedBy, rxType, purpose,
         odSph, odCyl, odAxis, odAdd, osSph, osCyl, osAxis, osAdd, 62, status, 'manual', 'pending', 'minus']
      );
      if (res.rowCount > 0) rxCreated++;
    }
    console.log(`Prescriptions created: ${rxCreated}`);
    
    // ── Summary ──
    console.log('\n=== SETUP COMPLETE ===');
    console.log(`Brands: ${results.brands}`);
    console.log(`Suppliers: ${results.suppliers}`);
    console.log(`Products: ${results.products}`);
    console.log(`Lens Packages: ${results.lensPackages}`);
    console.log(`Lens Options: ${results.lensOptions}`);
    console.log(`Stock entries: ${results.stock}`);
    console.log(`Customers: ${custCreated}`);
    console.log(`Prescriptions: ${rxCreated}`);
    
  } catch (e) { console.error('FATAL ERROR:', e.message); }
  finally { client.release(); await pool.end(); }
})();
