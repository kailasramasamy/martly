import { useEffect, useState } from "react";
import { Image, Tag, message } from "antd";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { axiosInstance } from "../../providers/data-provider";

const Photo = ({ url, isMain, draggable }: { url: string; isMain: boolean; draggable: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.7 : 1,
        cursor: draggable ? "grab" : undefined,
      }}
    >
      <Image width={100} height={100} style={{ borderRadius: 6, objectFit: "cover" }} src={url} />
      {isMain && <Tag color="#0d9488" style={{ position: "absolute", top: 4, left: 4, margin: 0 }}>Main</Tag>}
    </div>
  );
};

/** Product gallery; editors drag to reorder and the first photo becomes the main image */
export const ProductImages = ({ productId, images, canEdit, onSaved }: {
  productId: string;
  images: string[];
  canEdit: boolean;
  onSaved: () => void;
}) => {
  const [order, setOrder] = useState(images);
  useEffect(() => setOrder(images), [images]);
  // A small drag threshold keeps a plain click opening the preview
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    try {
      await axiosInstance.put(`/products/${productId}`, { images: next, imageUrl: next[0] });
      message.success("Photo order saved");
      onSaved();
    } catch {
      setOrder(order);
      message.error("Couldn't save the photo order");
    }
  };

  const draggable = canEdit && order.length > 1;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <Image.PreviewGroup>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {order.map((url, i) => <Photo key={url} url={url} isMain={i === 0} draggable={draggable} />)}
          </div>
        </Image.PreviewGroup>
      </SortableContext>
    </DndContext>
  );
};
