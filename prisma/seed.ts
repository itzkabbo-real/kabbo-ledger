import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();

  const products = await Promise.all([
    prisma.product.create({
      data: { name: "iPhone 15 Pro", brand: "Apple", category: "Phone", price: 1099, stock: 12 },
    }),
    prisma.product.create({
      data: { name: "Galaxy S24 Ultra", brand: "Samsung", category: "Phone", price: 1199, stock: 8 },
    }),
    prisma.product.create({
      data: { name: "Pixel 8", brand: "Google", category: "Phone", price: 699, stock: 15 },
    }),
    prisma.product.create({
      data: { name: "AirPods Pro 2", brand: "Apple", category: "Accessory", price: 249, stock: 30 },
    }),
    prisma.product.create({
      data: { name: "Fast Charger 65W", brand: "Anker", category: "Accessory", price: 39, stock: 50 },
    }),
  ]);

  await prisma.sale.create({
    data: {
      productId: products[0].id,
      quantity: 1,
      unitPrice: products[0].price,
      total: products[0].price,
      customerName: "Walk-in Customer",
    },
  });

  console.log(`Seeded ${products.length} products and 1 sale.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
