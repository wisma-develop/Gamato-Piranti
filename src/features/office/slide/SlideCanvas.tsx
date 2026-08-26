import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide, type SlideElement } from "./slideModel";

type DragMode = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se";

interface DragState {
  mode: DragMode;
  elId: string;
  startClientX: number;
  startClientY: number;
  startEl: { x: number; y: number; width: number; height: number };
}

const MIN_SIZE = 20;

export const SlideCanvas: React.FC<{
  slide: Slide;
  selectedId: string | null;
  editingTextId: string | null;
  onSelect: (id: string | null) => void;
  onChangeElement: (id: string, patch: Partial<SlideElement>, opts?: { commit?: boolean }) => void;
  onCommitChange: () => void;
  onStartEditText: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onStopEditText: () => void;
  readOnly?: boolean;
}> = ({ slide, selectedId, editingTextId, onSelect, onChangeElement, onCommitChange, onStartEditText, onChangeText, onStopEditText, readOnly }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<DragState | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / SLIDE_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editingTextId && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
    }
  }, [editingTextId]);

  const beginDrag = useCallback(
    (mode: DragMode, el: SlideElement, e: React.PointerEvent) => {
      if (readOnly) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(el.id);
      dragRef.current = {
        mode,
        elId: el.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startEl: { x: el.x, y: el.y, width: el.width, height: el.height },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onSelect, readOnly]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || scale <= 0) return;
      const dx = (e.clientX - drag.startClientX) / scale;
      const dy = (e.clientY - drag.startClientY) / scale;
      const { x, y, width, height } = drag.startEl;

      if (drag.mode === "move") {
        const nx = Math.max(0, Math.min(SLIDE_WIDTH - width, x + dx));
        const ny = Math.max(0, Math.min(SLIDE_HEIGHT - height, y + dy));
        onChangeElement(drag.elId, { x: nx, y: ny }, { commit: false });
        return;
      }

      let nx = x, ny = y, nw = width, nh = height;
      if (drag.mode === "resize-se") {
        nw = Math.max(MIN_SIZE, width + dx);
        nh = Math.max(MIN_SIZE, height + dy);
      } else if (drag.mode === "resize-ne") {
        nw = Math.max(MIN_SIZE, width + dx);
        nh = Math.max(MIN_SIZE, height - dy);
        ny = y + (height - nh);
      } else if (drag.mode === "resize-sw") {
        nw = Math.max(MIN_SIZE, width - dx);
        nh = Math.max(MIN_SIZE, height + dy);
        nx = x + (width - nw);
      } else if (drag.mode === "resize-nw") {
        nw = Math.max(MIN_SIZE, width - dx);
        nh = Math.max(MIN_SIZE, height - dy);
        nx = x + (width - nw);
        ny = y + (height - nh);
      }
      onChangeElement(drag.elId, { x: nx, y: ny, width: nw, height: nh }, { commit: false });
    },
    [scale, onChangeElement]
  );

  const onPointerUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      onCommitChange();
    }
  }, [onCommitChange]);

  return (
    <div
      ref={outerRef}
      className="relative w-full bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden"
      style={{ aspectRatio: `${SLIDE_WIDTH} / ${SLIDE_HEIGHT}` }}
      onPointerDown={() => !readOnly && onSelect(null)}
    >
      <div
        className="absolute top-0 left-0 origin-top-left shadow-sm"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale})`,
          background: slide.background,
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {slide.elements.map((el) => {
          const isSelected = !readOnly && el.id === selectedId;
          const isEditing = el.id === editingTextId;
          return (
            <div
              key={el.id}
              onPointerDown={(e) => beginDrag("move", el, e)}
              onDoubleClick={(e) => {
                if (el.kind === "text") {
                  e.stopPropagation();
                  onStartEditText(el.id);
                }
              }}
              className={cn("absolute", !readOnly && "cursor-move", isSelected && "outline outline-2 outline-indigo-500")}
              style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
            >
              {el.kind === "text" &&
                (isEditing ? (
                  <textarea
                    ref={textAreaRef}
                    value={el.text}
                    onChange={(e) => onChangeText(el.id, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={onStopEditText}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        onStopEditText();
                      }
                    }}
                    className="w-full h-full resize-none bg-transparent outline-none ring-2 ring-indigo-500 rounded"
                    style={{
                      fontSize: el.fontSize,
                      fontWeight: el.bold ? 700 : 400,
                      fontStyle: el.italic ? "italic" : "normal",
                      textAlign: el.align ?? "left",
                      color: el.color,
                      fontFamily: "Arial, sans-serif",
                      lineHeight: 1.3,
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full whitespace-pre-wrap break-words"
                    style={{
                      fontSize: el.fontSize,
                      fontWeight: el.bold ? 700 : 400,
                      fontStyle: el.italic ? "italic" : "normal",
                      textAlign: el.align ?? "left",
                      color: el.color,
                      fontFamily: "Arial, sans-serif",
                      lineHeight: 1.3,
                    }}
                  >
                    {el.text || (isSelected ? "Ketik teks…" : "")}
                  </div>
                ))}

              {el.kind === "shape" && el.shape === "rect" && (
                <div className="w-full h-full" style={{ background: el.fill, border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined }} />
              )}
              {el.kind === "shape" && el.shape === "ellipse" && (
                <div className="w-full h-full rounded-full" style={{ background: el.fill, border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined }} />
              )}
              {el.kind === "shape" && el.shape === "line" && (
                <svg width={el.width} height={el.height} className="overflow-visible">
                  <line x1={0} y1={0} x2={el.width} y2={el.height} stroke={el.fill} strokeWidth={el.strokeWidth || 4} />
                </svg>
              )}
              {el.kind === "image" && <img src={el.src} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />}

              {isSelected && !isEditing && (
                <>
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <div
                      key={corner}
                      onPointerDown={(e) => beginDrag(`resize-${corner}` as DragMode, el, e)}
                      className={cn(
                        "absolute w-3 h-3 bg-white border-2 border-indigo-500 rounded-full",
                        corner === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
                        corner === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
                        corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                        corner === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize"
                      )}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
