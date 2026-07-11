import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, brand, category, price, stock } = body;

    if (!name || !brand || price === undefined || price === null) {
      return NextResponse.json(
        { error: "name, brand and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: String(name),
        brand: String(brand),
        category: category ? String(category) : "Phone",
        price: Number(price),
        stock: stock !== undefined ? Number(stock) : 0,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
