import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Зөв и-мэйл хаяг оруулна уу"),
  password: z.string().min(6, "Нууц үг доод тал нь 6 тэмдэгт байна"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Нэрээ оруулна уу"),
  email: z.string().email("Зөв и-мэйл хаяг оруулна уу"),
  phone: z.string().min(6, "Утасны дугаараа оруулна уу").optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Нууц үг доод тал нь 6 тэмдэгт байна"),
});

export const propertySchema = z.object({
  title: z.string().min(3, "Гарчиг доод тал нь 3 тэмдэгт"),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Үнэ 0-ээс их байна"),
  currency: z.string().default("MNT"),
  location: z.string().optional().or(z.literal("")),
  district: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  area: z.coerce.number().min(0).optional(),
  rooms: z.coerce.number().int().min(0).max(30).optional(),
  bathrooms: z.coerce.number().int().min(0).max(10).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  total_floors: z.coerce.number().int().min(0).max(200).optional(),
  year_built: z.coerce.number().int().min(1900).max(2100).optional(),
  property_type: z.enum(["apartment", "house", "office", "land", "commercial"]).default("apartment"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  video_url: z.string().url("Зөв холбоос оруулна уу").optional().or(z.literal("")),
  amenities: z.array(z.string()).default([]),
});

export const leadSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2, "Нэрээ оруулна уу"),
  phone: z.string().min(6, "Утасны дугаараа оруулна уу"),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(1000).optional().or(z.literal("")),
});

export const profileSchema = z.object({
  full_name: z.string().min(2, "Нэрээ оруулна уу"),
  phone: z.string().optional().or(z.literal("")),
  company_name: z.string().optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
});

export type PropertyInput = z.infer<typeof propertySchema>;
export type LeadInput = z.infer<typeof leadSchema>;
