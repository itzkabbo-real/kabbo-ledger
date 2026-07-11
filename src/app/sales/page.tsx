import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { SaleForm } from "@/components/SaleForm";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [products, sales] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Ledger</h1>
        <p className="text-slate-500">
          Record sales and review your transaction history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SaleForm
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
            }))}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No sales yet. Record your first sale on the left.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {sale.product.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sale.customerName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {sale.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(sale.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
