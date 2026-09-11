import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ProductsDataTable } from "@/components/products-data-table";

// Composition mirrors the official shadcn "dashboard-01" block's page.tsx
// (sidebar + header + SectionCards + ChartAreaInteractive + a table), with
// ProductsDataTable wired to the real Roya House product catalog.
export function DashboardPage() {
  return (
    <AppShell
      title="داشبورد"
      actions={
        <Button asChild size="sm">
          <Link to="/documents/proforma/new">
            <Plus /> پیش فاکتور جدید
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <ProductsDataTable />
      </div>
    </AppShell>
  );
}
