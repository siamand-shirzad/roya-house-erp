import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Contact,
  Ellipsis,
  FileStack,
  Pencil,
  Plus,
  Settings2,
  Trash,
} from "lucide-react";

import { DocumentTypeIcon } from "@/lib/icons";
import { toDisplayDigits } from "@/lib/format";
import type { Customer } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  rows: Customer[];
  loading: boolean;
  totalCustomers: number;
  canEdit: boolean;
  canSell: boolean;
  canInvoice: boolean;
  onCreate: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onOpenDocuments: (customer: Customer) => void;
  onCreateDocument: (customer: Customer, type: "PROFORMA" | "INVOICE") => void;
};

const COLUMN_LABELS: Record<string, string> = {
  customer: "مشتری",
  customerCode: "کد مشتری",
  phone: "تلفن",
  city: "شهرستان",
  nationalId: "شناسه ملی",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
}

export function CustomerDataTable(props: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "customer", desc: false }]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ customerCode: false });

  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="انتخاب همه مشتریان این صفحه"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`انتخاب ${row.original.name}`}
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "customer",
      accessorFn: (row) => row.name,
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-me-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          مشتری <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex min-w-52 items-center gap-3">
          <Avatar className="size-9 border">
            <AvatarFallback className="bg-muted text-xs font-medium">{initials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link className="block truncate font-medium underline-offset-4 hover:text-primary hover:underline" to={`/customers/${row.original.id}`}>
              {row.original.name}
            </Link>
            <p className="max-w-64 truncate text-xs text-muted-foreground">{row.original.address || "بدون نشانی ثبت‌شده"}</p>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "customerCode",
      header: "کد مشتری",
      cell: ({ row }) => <span className="tabular-nums">{row.original.customerCode || "—"}</span>,
    },
    {
      accessorKey: "phone",
      header: "تلفن",
      cell: ({ row }) => <span className="block text-right tabular-nums" dir="ltr">{row.original.phone || "—"}</span>,
    },
    {
      accessorKey: "city",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-me-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          شهرستان <ArrowUpDown />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <p>{row.original.city || "—"}</p>
          {row.original.province && <p className="text-xs text-muted-foreground">{row.original.province}</p>}
        </div>
      ),
    },
    {
      accessorKey: "nationalId",
      header: "شناسه ملی",
      cell: ({ row }) => <span className="tabular-nums">{row.original.nationalId || "—"}</span>,
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <DropdownMenu dir="rtl" modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`عملیات ${customer.name}`}><Ellipsis /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem disabled={!props.canEdit} onSelect={() => props.onEdit(customer)}><Pencil /> ویرایش مشتری</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => props.onOpenDocuments(customer)}><FileStack /> اسناد این مشتری</DropdownMenuItem>
              {props.canSell && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => props.onCreateDocument(customer, "PROFORMA")}><DocumentTypeIcon type="PROFORMA" /> پیش‌فاکتور جدید</DropdownMenuItem>
                  <DropdownMenuItem disabled={!props.canInvoice} onSelect={() => props.onCreateDocument(customer, "INVOICE")}><DocumentTypeIcon type="INVOICE" /> فاکتور جدید</DropdownMenuItem>
                </>
              )}
              {props.canEdit && (
                <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => props.onDelete(customer)}><Trash /> حذف مشتری</DropdownMenuItem></>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [props]);

  const table = useReactTable({
    data: props.rows,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-5">
        <div>
          <h2 className="font-medium tracking-tight">دفتر مشتریان</h2>
          <p className="mt-1 text-sm text-muted-foreground">اطلاعات تماس و اسناد مشتریان را از یک‌جا مدیریت کنید.</p>
        </div>
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Settings2 /> نمایش ستون‌ها <ChevronDown /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>ستون‌های جدول</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
              <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}>
                {COLUMN_LABELS[column.id] || column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/45">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {props.loading ? Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>{table.getVisibleLeafColumns().map((column) => <TableCell key={column.id}><Skeleton className="h-5 w-full max-w-28" /></TableCell>)}</TableRow>
            )) : table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length} className="h-32 text-center text-muted-foreground">مشتری‌ای با این جستجو پیدا نشد.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y md:hidden">
        {props.loading ? Array.from({ length: 4 }).map((_, index) => <div className="space-y-2 p-4" key={index}><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-52" /></div>) :
          table.getRowModel().rows.map(({ original: customer }) => (
            <div key={customer.id} className="flex items-start gap-3 p-4">
              <Avatar className="size-10 border"><AvatarFallback className="bg-muted text-xs">{initials(customer.name)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <Link to={`/customers/${customer.id}`} className="font-medium">{customer.name}</Link>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums" dir="ltr">{customer.phone || "بدون شماره تماس"}</p>
                <p className="truncate text-sm text-muted-foreground">{[customer.province, customer.city].filter(Boolean).join("، ") || "بدون نشانی"}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`ویرایش ${customer.name}`} disabled={!props.canEdit} onClick={() => props.onEdit(customer)}><Pencil /></Button>
            </div>
          ))}
        {!props.loading && props.rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
            <Contact className="size-7" />
            <p>{props.totalCustomers ? "مشتری‌ای با این جستجو پیدا نشد." : "هنوز مشتری‌ای ثبت نشده است."}</p>
            {!props.totalCustomers && <Button size="sm" onClick={props.onCreate} disabled={!props.canEdit}><Plus /> افزودن اولین مشتری</Button>}
          </div>
        )}
      </div>

      {!props.loading && props.rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {toDisplayDigits(table.getFilteredSelectedRowModel().rows.length)} انتخاب از {toDisplayDigits(props.rows.length)} مشتری
          </p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums">صفحه {toDisplayDigits(table.getState().pagination.pageIndex + 1)} از {toDisplayDigits(Math.max(1, table.getPageCount()))}</span>
            <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="صفحه قبل"><ChevronRight /></Button>
            <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="صفحه بعد"><ChevronLeft /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
