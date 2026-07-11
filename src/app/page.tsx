import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const [products, sales] = await Promise.all([
    prisma.product.findMany(),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
    }),
  ]);

  const revenue = sales.reduce((sum, s) => sum + s.total, 0);
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  );
  const lowStock = products.filter((p) => p.stock <= 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Overview of your mobile shop inventory and sales.
          </p>
        </div>
        <Link
          href="/sales"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New Sale
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={String(products.length)} />
        <StatCard label="Sales" value={String(sales.length)} />
        <StatCard
          label="Revenue"
          value={formatCurrency(revenue)}
          accent="text-emerald-600"
        />
        <StatCard
          label="Inventory Value"
          value={formatCurrency(inventoryValue)}
          accent="text-brand-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Recent Sales
          </h2>
          {sales.length === 0 ? (
            <p className="text-sm text-slate-500">No sales recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sales.slice(0, 5).map((sale) => (
                <li
                  key={sale.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {sale.product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {sale.quantity} × {formatCurrency(sale.unitPrice)} ·{" "}
                      {formatDate(sale.createdAt)}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(sale.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Low Stock Alert
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">
              All products are well stocked.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500">{product.brand}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {product.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
