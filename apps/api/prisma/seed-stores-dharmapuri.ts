/**
 * Seed Dharmapuri-district stores (Dharmapuri town + Harur) for the mobile store-discovery screen.
 * Moves Downtown Mart to Dharmapuri, adds nearby stores with photos (Unsplash → S3),
 * express-delivery hours/ETA, delivery tiers, and copies Downtown Mart's catalog so each store is shoppable.
 * Run: cd apps/api && npx tsx prisma/seed-stores-dharmapuri.ts
 */

import { PrismaClient } from "../generated/prisma/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const BUCKET = process.env.S3_BUCKET!;
const KEY_PREFIX = process.env.S3_KEY_PREFIX || "martly";
const BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL!;
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const SOURCE_SLUG = "downtown-mart";
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&h=800&fit=crop&crop=center`;

interface StoreSeed {
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadius: number;
  minOrderAmount: number;
  freeDeliveryThreshold: number;
  baseDeliveryFee: number;
  etaMinutes: number;
  hours: [string, string];
  photo: string;
}

const STORES: StoreSeed[] = [
  { slug: SOURCE_SLUG, name: "Downtown Mart", address: "Four Roads, Dharmapuri, Tamil Nadu 636701",
    latitude: 12.1311, longitude: 78.158, deliveryRadius: 7, minOrderAmount: 99, freeDeliveryThreshold: 299,
    baseDeliveryFee: 25, etaMinutes: 15, hours: ["06:00", "23:00"], photo: "1534723452862-4c874018d66d" },
  { slug: "annapoorna-supermart-pennagaram-road", name: "Annapoorna Supermart", address: "Pennagaram Road, Dharmapuri, Tamil Nadu 636701",
    latitude: 12.1342, longitude: 78.143, deliveryRadius: 6, minOrderAmount: 149, freeDeliveryThreshold: 399,
    baseDeliveryFee: 30, etaMinutes: 20, hours: ["07:00", "22:30"], photo: "1578916171728-46686eac8d58" },
  { slug: "kaveri-fresh-nethaji-bypass", name: "Kaveri Fresh", address: "Nethaji Bypass Road, Dharmapuri, Tamil Nadu 636705",
    latitude: 12.1405, longitude: 78.165, deliveryRadius: 5, minOrderAmount: 99, freeDeliveryThreshold: 249,
    baseDeliveryFee: 20, etaMinutes: 12, hours: ["06:30", "22:00"], photo: "1542838132-92c53300491e" },
  { slug: "greenleaf-organics-krishnagiri-road", name: "GreenLeaf Organics", address: "Krishnagiri Road, Sogathur, Dharmapuri, Tamil Nadu 636809",
    latitude: 12.165, longitude: 78.172, deliveryRadius: 8, minOrderAmount: 199, freeDeliveryThreshold: 499,
    baseDeliveryFee: 35, etaMinutes: 25, hours: ["08:00", "21:00"], photo: "1550989460-0adf9ea622e2" },
  { slug: "sri-murugan-stores-adhiyamankottai", name: "Sri Murugan Stores", address: "Salem Main Road, Adhiyamankottai, Dharmapuri, Tamil Nadu 636807",
    latitude: 12.0886, longitude: 78.1259, deliveryRadius: 6, minOrderAmount: 99, freeDeliveryThreshold: 299,
    baseDeliveryFee: 25, etaMinutes: 30, hours: ["06:00", "22:00"], photo: "1533900298318-6b8da08a523e" },
  { slug: "nallampalli-daily-needs", name: "Nallampalli Daily Needs", address: "Main Bazaar, Nallampalli, Dharmapuri, Tamil Nadu 636807",
    latitude: 12.064, longitude: 78.056, deliveryRadius: 5, minOrderAmount: 99, freeDeliveryThreshold: 299,
    baseDeliveryFee: 25, etaMinutes: 35, hours: ["07:00", "21:30"], photo: "1604719312566-8912e9227c6a" },
  { slug: "harur-fresh-mart-bus-stand", name: "Harur Fresh Mart", address: "Main Road, Harur Taluk, Dharmapuri, Tamil Nadu",
    latitude: 12.244, longitude: 78.269, deliveryRadius: 6, minOrderAmount: 99, freeDeliveryThreshold: 249,
    baseDeliveryFee: 20, etaMinutes: 10, hours: ["06:00", "22:30"], photo: "1488459716781-31db52582fe9" },
  { slug: "thamizh-supermarket-theerthamalai-road", name: "Thamizh Supermarket", address: "Market Street, Harur Taluk, Dharmapuri, Tamil Nadu",
    latitude: 12.225, longitude: 78.256, deliveryRadius: 7, minOrderAmount: 149, freeDeliveryThreshold: 399,
    baseDeliveryFee: 30, etaMinutes: 18, hours: ["07:00", "23:00"], photo: "1601599561213-832382fd07ba" },
  { slug: "harur-daily-basket-morappur-road", name: "Harur Daily Basket", address: "Bus Stop Road, Harur Taluk, Dharmapuri, Tamil Nadu",
    latitude: 12.256, longitude: 78.29, deliveryRadius: 5, minOrderAmount: 99, freeDeliveryThreshold: 299,
    baseDeliveryFee: 25, etaMinutes: 22, hours: ["06:30", "21:30"], photo: "1543168256-418811576931" },
];

async function uploadStorePhoto(slug: string, photoId: string): Promise<string> {
  const res = await fetch(unsplash(photoId));
  if (!res.ok) throw new Error(`Unsplash ${photoId} returned ${res.status}`);
  const image = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(600, 600, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `${KEY_PREFIX}/stores/${slug}-${randomUUID().slice(0, 8)}.webp`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: image, ContentType: "image/webp" }));
  return `${BASE_URL}/${key}`;
}

async function upsertStore(seed: StoreSeed, organizationId: string): Promise<string> {
  const existing = await prisma.store.findUnique({ where: { slug: seed.slug }, select: { imageUrl: true } });
  const imageUrl = existing?.imageUrl ?? (await uploadStorePhoto(seed.slug, seed.photo));
  const data = {
    name: seed.name, address: seed.address, imageUrl, status: "ACTIVE" as const,
    latitude: seed.latitude, longitude: seed.longitude, deliveryRadius: seed.deliveryRadius,
    minOrderAmount: seed.minOrderAmount, freeDeliveryThreshold: seed.freeDeliveryThreshold,
    baseDeliveryFee: seed.baseDeliveryFee,
  };
  const store = await prisma.store.upsert({
    where: { slug: seed.slug },
    update: data,
    create: { ...data, slug: seed.slug, organizationId },
  });
  const express = { isEnabled: true, etaMinutes: seed.etaMinutes, operatingStart: seed.hours[0], operatingEnd: seed.hours[1] };
  await prisma.expressDeliveryConfig.upsert({
    where: { storeId: store.id },
    update: express,
    create: { ...express, storeId: store.id },
  });
  return store.id;
}

// Three distance bands up to the store's radius; checkout needs a tier covering the customer's distance
async function upsertDeliveryTiers(storeId: string, seed: StoreSeed) {
  const third = seed.deliveryRadius / 3;
  const tiers = [0, 1, 2].map((i) => ({
    storeId,
    minDistance: Math.round(i * third * 10) / 10,
    maxDistance: i === 2 ? seed.deliveryRadius : Math.round((i + 1) * third * 10) / 10,
    deliveryFee: seed.baseDeliveryFee + i * 10,
    estimatedMinutes: seed.etaMinutes + i * 5,
  }));
  await prisma.$transaction([
    prisma.deliveryTier.deleteMany({ where: { storeId } }),
    prisma.deliveryTier.createMany({ data: tiers }),
  ]);
}

async function copyCatalog(sourceStoreId: string, targetStoreId: string): Promise<number> {
  const source = await prisma.storeProduct.findMany({
    where: { storeId: sourceStoreId, isActive: true },
    select: { productId: true, variantId: true, price: true, discountType: true, discountValue: true,
      discountStart: true, discountEnd: true, memberPrice: true, isFeatured: true },
  });
  const result = await prisma.storeProduct.createMany({
    data: source.map((sp) => ({ ...sp, storeId: targetStoreId, stock: 20 + Math.floor(Math.random() * 80) })),
    skipDuplicates: true,
  });
  return result.count;
}

async function main() {
  const source = await prisma.store.findUnique({ where: { slug: SOURCE_SLUG } });
  if (!source) throw new Error(`Source store "${SOURCE_SLUG}" not found`);

  for (const seed of STORES) {
    const storeId = await upsertStore(seed, source.organizationId);
    await upsertDeliveryTiers(storeId, seed);
    const copied = seed.slug === SOURCE_SLUG ? 0 : await copyCatalog(source.id, storeId);
    console.log(`✔ ${seed.name} — ${copied} products copied`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
