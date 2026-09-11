import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentType } from "@/types";

export type BuyerFormState = {
  buyerName: string;
  buyerNationalId: string;
  buyerEconomicCode: string;
  buyerProvince: string;
  buyerCity: string;
  buyerAddress: string;
  buyerPostalCode: string;
  buyerPhone: string;
};

export type GoodsIssueFormState = {
  relatedInvoiceNo: string;
  deliveredToName: string;
  deliveredToNationalId: string;
  vehicleColor: string;
  vehiclePlate: string;
};

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

export function BuyerForm({
  value,
  onChange,
  disabled,
}: {
  value: BuyerFormState;
  onChange: (v: BuyerFormState) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof BuyerFormState) => (v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="نام خریدار" value={value.buyerName} onChange={set("buyerName")} disabled={disabled} />
      <Field label="شناسه ملی / کد ملی" value={value.buyerNationalId} onChange={set("buyerNationalId")} disabled={disabled} />
      <Field label="شماره اقتصادی" value={value.buyerEconomicCode} onChange={set("buyerEconomicCode")} disabled={disabled} />
      <Field label="شماره تلفن / نمابر" value={value.buyerPhone} onChange={set("buyerPhone")} disabled={disabled} />
      <Field label="استان" value={value.buyerProvince} onChange={set("buyerProvince")} disabled={disabled} />
      <Field label="شهرستان" value={value.buyerCity} onChange={set("buyerCity")} disabled={disabled} />
      <Field label="کدپستی" value={value.buyerPostalCode} onChange={set("buyerPostalCode")} disabled={disabled} />
      <Field label="آدرس" value={value.buyerAddress} onChange={set("buyerAddress")} disabled={disabled} />
    </div>
  );
}

export function GoodsIssueForm({
  value,
  onChange,
  disabled,
}: {
  value: GoodsIssueFormState;
  onChange: (v: GoodsIssueFormState) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof GoodsIssueFormState) => (v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="شماره فاکتور مرتبط" value={value.relatedInvoiceNo} onChange={set("relatedInvoiceNo")} disabled={disabled} />
      <Field label="نام تحویل‌گیرنده" value={value.deliveredToName} onChange={set("deliveredToName")} disabled={disabled} />
      <Field
        label="کد ملی تحویل‌گیرنده"
        value={value.deliveredToNationalId}
        onChange={set("deliveredToNationalId")}
        disabled={disabled}
      />
      <Field label="رنگ خودرو" value={value.vehicleColor} onChange={set("vehicleColor")} disabled={disabled} />
      <Field label="شماره پلاک" value={value.vehiclePlate} onChange={set("vehiclePlate")} disabled={disabled} />
    </div>
  );
}

export function typeNeedsGoodsIssueFields(type: DocumentType) {
  return type === "GOODS_ISSUE";
}
