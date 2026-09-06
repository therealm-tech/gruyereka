import { z } from "zod";
import { API_ERROR_CODES } from "@/lib/api/errors";
import {
  MILK_TYPES,
  OSM_ELEMENTS,
  PASTE_TYPES,
  PROTECTED_DESIGNATIONS,
  RATING_LEVELS,
  SHOP_KINDS,
  USER_ROLES,
} from "@/lib/vocabulary";

/**
 * The wire contract, once. Every response crossing the boundary is parsed
 * through one of these, so the runtime shape and the static type cannot drift
 * from what gruyereka-api actually sends.
 */

/**
 * What the upload route accepts. Part of the contract, and needed in the
 * browser to refuse a file before it crosses — so it lives here rather than in
 * a `server-only` module.
 */
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const pricePerKgSchema = z.object({
  amountCents: z.number().int(),
  currency: z.string().length(3),
});
export type PricePerKg = z.infer<typeof pricePerKgSchema>;

export const osmReferenceSchema = z.object({
  element: z.enum(OSM_ELEMENTS),
  id: z.number().int(),
});
export type OsmReference = z.infer<typeof osmReferenceSchema>;

export const cheeseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  milkTypes: z.array(z.enum(MILK_TYPES)),
  pasteType: z.enum(PASTE_TYPES),
  designation: z.enum(PROTECTED_DESIGNATIONS).nullable(),
  agingMonths: z.number().int().nullable(),
  /** Path on the API; following it with credentials redirects to the bucket. */
  photoUrl: z.string().nullable(),
  tastingCount: z.number().int(),
  averageScore: z.number().nullable(),
  createdByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Cheese = z.infer<typeof cheeseSchema>;

export const tastingSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  cheeseId: z.uuid(),
  shopId: z.uuid(),
  rating: z.enum(RATING_LEVELS),
  pricePerKg: pricePerKgSchema.nullable(),
  comment: z.string().nullable(),
  tastedOn: z.iso.date(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Tasting = z.infer<typeof tastingSchema>;

export const shopSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.enum(SHOP_KINDS),
  osm: osmReferenceSchema,
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string(),
  countryCode: z.string().length(2),
  latitude: z.number(),
  longitude: z.number(),
  reviewCount: z.number().int(),
  averageScore: z.number().nullable(),
  createdByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Shop = z.infer<typeof shopSchema>;

export const shopReviewSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  shopId: z.uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ShopReview = z.infer<typeof shopReviewSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
  user: userSchema,
});
export type Session = z.infer<typeof sessionSchema>;

export const errorResponseSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});

/** Offset pagination, 1-based, with the size of the whole filtered set. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    perPage: z.number().int(),
    total: z.number().int(),
  });
}

export type Page<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
};
