import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });
  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, quantity, customerName } = body;

    const qty = Number(quantity);
    if (!productId || !qty || qty <= 0) {
      return NextResponse.json(
        { error: "productId and a positive quantity are required" },
        { status: 400 }
      );
    }

    const sale = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: Number(productId) },
      });

      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }
      if (product.stock < qty) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stock: product.stock - qty },
      });

      return tx.sale.create({
        data: {
          productId: product.id,
          quantity: qty,
          unitPrice: product.price,
          total: product.price * qty,
          customerName: customerName ? String(customerName) : null,
        },
        include: { product: true },
      });
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Not enough stock for this sale" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to record sale" },
      { status: 500 }
    );
  }
}
