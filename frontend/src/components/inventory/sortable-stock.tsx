import { createContext, useContext, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

const HandleContext = createContext<ReturnType<typeof useSortable> | null>(null);
export function SortableStockRow({ id, children }: { id: string; children: ReactNode }) {
  const sortable = useSortable({ id });
  return <HandleContext.Provider value={sortable}><tr ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, position: "relative", zIndex: sortable.isDragging ? 1 : undefined, opacity: sortable.isDragging ? 0.65 : 1 }} className="bg-card hover:bg-muted/40">{children}</tr></HandleContext.Provider>;
}
export function StockDragHandle({ name }: { name: string }) {
  const row = useContext(HandleContext)!;
  return <Button variant="ghost" size="icon" ref={row.setActivatorNodeRef} {...row.attributes} {...row.listeners} aria-label={`جابه‌جایی ${name}`} className="touch-none cursor-grab active:cursor-grabbing"><GripVertical /></Button>;
}
export function StockSortContext({ ids, onMove, children }: { ids: string[]; onMove: (from: string, to: string) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const end = ({ active, over }: DragEndEvent) => { if (over && active.id !== over.id) onMove(String(active.id), String(over.id)); };
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>;
}
export function useStockOrder(userId: string | undefined, ids: string[]) {
  const key = `inventory-order:${userId}`;
  const [order, setOrder] = useState<string[]>(() => { try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; } catch { return []; } });
  const all = [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
  const move = (from: string, to: string) => {
    const a = all.indexOf(from), b = all.indexOf(to);
    if (a < 0 || b < 0) return;
    const next = arrayMove(all, a, b); setOrder(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Order remains usable for this session. */ }
  };
  return { order: all, move };
}
