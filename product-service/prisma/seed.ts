import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedProduct = {
  name: string;
  price: number;
  description: string;
};

const catalog: Record<
  string,
  { name: string; products: SeedProduct[] }
> = {
  electronics: {
    name: "Electronics",
    products: [
      { name: "Wireless Noise-Cancelling Headphones", price: 4999, description: "Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life." },
      { name: "Smart Fitness Watch", price: 3499, description: "Fitness watch with heart-rate tracking, sleep insights, and notification support." },
      { name: "Portable Bluetooth Speaker", price: 2199, description: "Water-resistant portable speaker with rich stereo sound and twelve-hour playback." },
      { name: "Mechanical Gaming Keyboard", price: 4299, description: "RGB mechanical keyboard with tactile switches and programmable shortcuts." },
      { name: "Ergonomic Wireless Mouse", price: 1599, description: "Comfortable wireless mouse with adjustable sensitivity and silent buttons." },
      { name: "USB-C Fast Charger", price: 1299, description: "Compact 45-watt USB-C charger suitable for phones, tablets, and ultrabooks." },
      { name: "Full HD Webcam", price: 2799, description: "1080p webcam with dual microphones, privacy cover, and automatic exposure." },
      { name: "Ten-In-One USB-C Hub", price: 3299, description: "USB-C hub with HDMI, Ethernet, card readers, and power delivery passthrough." },
      { name: "True Wireless Earbuds", price: 2999, description: "Compact wireless earbuds with touch controls and a pocket charging case." },
      { name: "20000 mAh Power Bank", price: 2499, description: "High-capacity power bank with dual USB output and USB-C fast charging." },
    ],
  },
  "home-kitchen": {
    name: "Home & Kitchen",
    products: [
      { name: "Digital Air Fryer", price: 6999, description: "Large digital air fryer with presets for quick meals using less oil." },
      { name: "Stainless Steel Water Bottle", price: 899, description: "Double-wall insulated bottle that keeps beverages hot or cold for hours." },
      { name: "Automatic Coffee Maker", price: 5499, description: "Programmable coffee maker with reusable filter and keep-warm function." },
      { name: "Non-Stick Cookware Set", price: 3999, description: "Durable five-piece cookware set with induction-compatible bases." },
      { name: "High-Speed Blender", price: 4499, description: "Powerful countertop blender for smoothies, sauces, and crushed ice." },
      { name: "Memory Foam Pillow", price: 1799, description: "Contoured memory foam pillow designed for comfortable neck support." },
      { name: "LED Desk Lamp", price: 1499, description: "Adjustable desk lamp with touch controls and multiple brightness levels." },
      { name: "Cotton Bedsheet Set", price: 2299, description: "Soft breathable cotton bedsheet set with two matching pillow covers." },
      { name: "Digital Kitchen Scale", price: 999, description: "Compact kitchen scale with precise measurements and tare functionality." },
      { name: "Robot Vacuum Cleaner", price: 12999, description: "Smart robotic vacuum with scheduled cleaning and automatic charging." },
    ],
  },
  fashion: {
    name: "Fashion",
    products: [
      { name: "Classic Denim Jacket", price: 2999, description: "Everyday denim jacket with a regular fit and durable metal buttons." },
      { name: "Premium Cotton T-Shirt", price: 799, description: "Soft combed-cotton crew-neck T-shirt for comfortable daily wear." },
      { name: "Slim Fit Chino Trousers", price: 1899, description: "Versatile stretch-cotton chinos with a modern slim fit." },
      { name: "Everyday Running Shoes", price: 3299, description: "Lightweight running shoes with cushioned midsoles and breathable uppers." },
      { name: "Leather Casual Belt", price: 1199, description: "Genuine leather belt with an understated brushed-metal buckle." },
      { name: "Polarized Sunglasses", price: 1699, description: "UV-protection sunglasses with polarized lenses and a lightweight frame." },
      { name: "Canvas Travel Backpack", price: 2499, description: "Spacious travel backpack with padded laptop sleeve and organized pockets." },
      { name: "Minimalist Analog Watch", price: 2799, description: "Clean analog watch design with a stainless steel case and leather strap." },
      { name: "Lightweight Hoodie", price: 1999, description: "Soft zip-up hoodie suitable for layering across seasons." },
      { name: "Formal Oxford Shirt", price: 1599, description: "Wrinkle-resistant Oxford shirt with a tailored collar and regular fit." },
    ],
  },
  "sports-outdoors": {
    name: "Sports & Outdoors",
    products: [
      { name: "Non-Slip Yoga Mat", price: 1399, description: "Cushioned yoga mat with a textured non-slip surface and carry strap." },
      { name: "Adjustable Dumbbell Set", price: 5999, description: "Space-saving adjustable dumbbells for strength workouts at home." },
      { name: "Insulated Hiking Backpack", price: 3499, description: "Trail backpack with hydration support, rain cover, and ventilated padding." },
      { name: "Professional Cricket Bat", price: 4299, description: "Seasoned willow cricket bat balanced for club-level stroke play." },
      { name: "Training Football", price: 1199, description: "Durable all-weather football suitable for regular practice sessions." },
      { name: "Badminton Racket Pair", price: 1999, description: "Two lightweight rackets with covers and a tube of shuttlecocks." },
      { name: "Resistance Band Kit", price: 999, description: "Five resistance levels with handles, anchors, and a travel pouch." },
      { name: "Camping Lantern", price: 1299, description: "Rechargeable LED camping lantern with adjustable brightness and power output." },
      { name: "Stainless Steel Bicycle Bottle", price: 749, description: "Leak-resistant bicycle bottle designed to fit standard bottle cages." },
      { name: "Quick-Dry Sports Towel", price: 699, description: "Compact microfiber towel that dries quickly after workouts or travel." },
    ],
  },
  books: {
    name: "Books",
    products: [
      { name: "Designing Reliable Systems", price: 899, description: "A practical introduction to availability, fault tolerance, and operations." },
      { name: "Practical Cloud Architecture", price: 999, description: "Patterns and tradeoffs for designing scalable applications in the cloud." },
      { name: "Modern JavaScript Handbook", price: 749, description: "A hands-on guide to contemporary JavaScript for frontend and backend work." },
      { name: "Applied Machine Learning", price: 1199, description: "An approachable guide to building and evaluating useful machine-learning systems." },
      { name: "Microservices in Practice", price: 949, description: "Service boundaries, communication patterns, data ownership, and observability." },
      { name: "Kubernetes Field Guide", price: 1099, description: "A practical Kubernetes reference covering workloads, networking, and operations." },
      { name: "Database Systems Explained", price: 849, description: "Foundations of relational, document, caching, and distributed data systems." },
      { name: "Clean API Design", price: 699, description: "Guidance for creating consistent, secure, and maintainable HTTP APIs." },
      { name: "Engineering Team Playbook", price: 799, description: "Collaboration practices for planning, reviewing, shipping, and learning together." },
      { name: "Chaos Engineering Essentials", price: 1049, description: "A concise guide to resilience hypotheses, safe experiments, and recovery analysis." },
    ],
  },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  let productNumber = 0;

  for (const [categorySlug, categorySeed] of Object.entries(catalog)) {
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: { name: categorySeed.name },
      create: { name: categorySeed.name, slug: categorySlug },
    });

    for (const seed of categorySeed.products) {
      productNumber += 1;
      const slug = slugify(seed.name);
      const data = {
        name: seed.name,
        description: seed.description,
        price: seed.price,
        comparePrice: Math.round(seed.price * 1.2),
        images: [] as string[],
        stock: 15 + ((productNumber * 7) % 86),
        featured: productNumber % 4 === 0,
        categoryId: category.id,
      };

      await prisma.product.upsert({
        where: { slug },
        update: data,
        create: { ...data, slug },
      });
    }
  }

  const [categoryCount, productCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
  ]);

  console.log(`Seed complete: ${categoryCount} categories and ${productCount} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
