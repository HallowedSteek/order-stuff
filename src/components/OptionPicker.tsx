"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { MenuEntry } from "@/lib/types";

/** Pick an item's options; enforces each group's min/max before "Add". */
export function OptionPicker({
  item,
  currency,
  onAdd,
  onCancel,
}: {
  item: MenuEntry;
  currency: string;
  onAdd: (options: Record<string, string[]>) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const toggle = (groupId: string, valueId: string, single: boolean) =>
    setPicked((p) => {
      const current = p[groupId] ?? [];
      if (single) return { ...p, [groupId]: current[0] === valueId ? [] : [valueId] };
      return {
        ...p,
        [groupId]: current.includes(valueId) ? current.filter((v) => v !== valueId) : [...current, valueId],
      };
    });

  const problems = item.options.filter((g) => {
    const n = picked[g.id]?.length ?? 0;
    return n < g.min || n > g.max;
  });

  return (
    <div className="picker">
      {item.options.map((group) => {
        const single = group.max === 1;
        const chosen = picked[group.id] ?? [];
        return (
          <fieldset key={group.id}>
            <legend>
              {group.name}{" "}
              <span className="muted">
                {group.min > 0 ? `pick ${group.min === group.max ? group.min : `${group.min}–${group.max}`}` : `optional, up to ${group.max}`}
              </span>
            </legend>
            {group.values.map((v) => (
              <label key={v.id} className="row">
                <input
                  type={single ? "radio" : "checkbox"}
                  name={`${item.id}-${group.id}`}
                  checked={chosen.includes(v.id)}
                  disabled={!single && !chosen.includes(v.id) && chosen.length >= group.max}
                  onClick={() => toggle(group.id, v.id, single)}
                  readOnly
                />
                {v.name}
                {v.price > 0 && <span className="muted">+{formatPrice(v.price, currency)}</span>}
              </label>
            ))}
          </fieldset>
        );
      })}
      <div className="row">
        <button type="button" disabled={problems.length > 0} onClick={() => onAdd(picked)}>
          Add
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
