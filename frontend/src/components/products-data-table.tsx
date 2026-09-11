import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, type Product, type ProductCategory } from "@/types";
import { formatToman, toDisplayDigits } from "@/lib/format";

// Drop-in replacement for dashboard-01's stock `<DataTable data={data} />`:
// same card/table chrome, but wired to the live Roya House product catalog
// (GET /api/products) instead of the block's local mock JSON.

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "code",
    header: "کد کالا",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.code ?? "—"}</span>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-mx-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        نام کالا
        <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        {row.original.spec && (
          <div className="text-xs text-muted-foreground">{row.original.spec}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "دسته‌بندی",
    cell: ({ row }) => <Badge variant="outline">{CATEGORY_LABELS[row.original.category]}</Badge>,
  },
  {
    accessorKey: "unit",
    header: "واحد",
  },
  {
    accessorKey: "unitPrice",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-mx-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        قیمت واحد (تومان)
        <ArrowUpDown className="size-3.5" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-medium">{formatToman(row.original.unitPrice)}</span>,
  },
  {
    accessorKey: "partnerPrice",
    header: "قیمت همکاری (تومان)",
    cell: ({ row }) =>
      row.original.partnerPrice ? (
        <span className="text-muted-foreground">{formatToman(row.original.partnerPrice)}</span>
      ) : (
        "—"
      ),
  },
];

export function ProductsDataTable() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [category, setCategory] = useState<ProductCategory | "ALL">("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    setLoading(true);
    api.products
      .list()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filteredData = useMemo(() => {
    if (category === "ALL") return data;
    return data.filter((p) => p.category === category);
  }, [data, category]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>فهرست قیمت محصولات رویا هاوس</CardTitle>
            <Button asChild variant="link" size="sm" className="h-auto px-0">
              <Link to="/products">ویرایش قیمت‌ها</Link>
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="جستجوی کالا..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pr-8 w-full sm:w-56"
              />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory | "ALL")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="دسته‌بندی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه دسته‌بندی‌ها</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="animate-spin" /> در حال بارگذاری کالاها...
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          کالایی یافت نشد.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-muted-foreground">
                  {toDisplayDigits(filteredData.length)} کالا
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
