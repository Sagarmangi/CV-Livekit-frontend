"use client";

import { useId, useState } from "react";

import { Button, Checkbox, Input } from "@/components/ui";

export type RowColumn =
  /** Carried through so the action can tell an edit from an insert. */
  | { name: string; kind: "hidden" }
  | {
      name: string;
      kind: "text";
      label: string;
      placeholder?: string;
      /** Tailwind width class, e.g. "sm:w-40". */
      width?: string;
    }
  | { name: string; kind: "bool"; label: string };

/**
 * An add/remove list of field groups that submits as parallel arrays — every
 * column posts under one repeated field name, and the server zips them back
 * into rows (see `rows()` in `lib/forms.ts`).
 *
 * Booleans post through a hidden input rather than a bare checkbox: an
 * unchecked checkbox is omitted from FormData entirely, which would shift every
 * later row's flag onto the wrong row.
 */
export function RepeatableRows({
  columns,
  initial,
  addLabel,
  emptyHint,
}: {
  columns: RowColumn[];
  initial: Record<string, string>[];
  addLabel: string;
  emptyHint?: string;
}) {
  const blank = () =>
    Object.fromEntries(
      columns.map((c) => [c.name, c.kind === "bool" ? "false" : ""]),
    );

  const [rows, setRows] = useState<Record<string, string>[]>(initial);
  // Row identity for React keys. Indices would reuse a key after a removal and
  // leave stale values in the inputs.
  const [keys, setKeys] = useState<number[]>(() => initial.map((_, i) => i));
  const [nextKey, setNextKey] = useState(initial.length);
  const idPrefix = useId();

  function update(index: number, name: string, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [name]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, blank()]);
    setKeys((current) => [...current, nextKey]);
    setNextKey((n) => n + 1);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
    setKeys((current) => current.filter((_, i) => i !== index));
  }

  const labelled = columns.filter((c) => c.kind !== "hidden");

  return (
    <div className="space-y-3">
      {rows.length === 0 && emptyHint && (
        <p className="text-sm text-muted">{emptyHint}</p>
      )}

      {rows.map((row, index) => (
        <div
          key={keys[index]}
          className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-canvas-alt p-3"
        >
          {columns.map((column) => {
            if (column.kind === "hidden") {
              return (
                <input
                  key={column.name}
                  type="hidden"
                  name={column.name}
                  value={row[column.name] ?? ""}
                />
              );
            }

            const inputId = `${idPrefix}-${index}-${column.name}`;

            if (column.kind === "bool") {
              const checked = row[column.name] === "true";
              return (
                <div key={column.name} className="flex items-center gap-2 pb-2">
                  <input type="hidden" name={column.name} value={String(checked)} />
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onChange={(e) =>
                      update(index, column.name, String(e.target.checked))
                    }
                  />
                  <label htmlFor={inputId} className="text-sm text-body">
                    {column.label}
                  </label>
                </div>
              );
            }

            return (
              <div
                key={column.name}
                className={column.width ?? "min-w-48 flex-1"}
              >
                {/* Labels repeat per row, so only the first set is visible —
                    the rest stay in the accessibility tree via sr-only. */}
                <label
                  htmlFor={inputId}
                  className={
                    index === 0
                      ? "mb-2 block text-sm font-medium text-body"
                      : "sr-only"
                  }
                >
                  {column.label}
                </label>
                <Input
                  id={inputId}
                  name={column.name}
                  value={row[column.name] ?? ""}
                  placeholder={column.placeholder}
                  onChange={(e) => update(index, column.name, e.target.value)}
                />
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeRow(index)}
            aria-label={`Remove row ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}

      {/* Keeps the column headers meaningful when every row has been removed. */}
      <span className="sr-only">
        Columns: {labelled.map((c) => c.label).join(", ")}
      </span>

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        + {addLabel}
      </Button>
    </div>
  );
}
