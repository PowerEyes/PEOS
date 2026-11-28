/**
 * PowerOS SaaS Shared Utilities
 */

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
};

export const isValidGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  return gstinRegex.test(gstin);
};

export const isValidPAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
};

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

export const generateBranchCode = (name: string): string => {
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
    .slice(0, 6);
};

export const isValidOrgName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 100;
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const isExpired = (date: string | Date | null | undefined): boolean => {
  if (!date) return true;
  return new Date(date) < new Date();
};

export const isExpiringSoon = (date: string | Date, days: number = 30): boolean => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
};

export const calculateAge = (dob: string): number => {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    branch_manager: "Branch Manager",
    staff: "Staff",
    optometrist: "Optometrist",
    sales_executive: "Sales Executive",
    cashier: "Cashier",
    inventory_manager: "Inventory Manager",
    lab_technician: "Lab Technician",
    accountant: "Accountant",
    receptionist: "Receptionist",
  };
  return labels[role] || role;
};

export const getPlatformRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    support: "Support",
    billing: "Billing",
    read_only: "Read Only",
  };
  return labels[role] || role;
};

export const getOrgStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    trial: "Trial",
    active: "Active",
    past_due: "Past Due",
    suspended: "Suspended",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
};

export const getPlanTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
  };
  return labels[tier] || tier;
};

export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
};

export const generateInviteToken = (): string => {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
};