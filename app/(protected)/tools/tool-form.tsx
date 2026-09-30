"use client";

import { useState } from "react";

import { saveTool, deleteTool } from "@/app/(protected)/tools/actions";
import { Dropdown } from "@/components/dropdown";
import { ActionButton, ActionForm } from "@/components/form";
import { ToolParameterBuilder } from "@/components/tool-parameter-builder";
import { Field, Input, StaticValue, Textarea, ToolTypeGlyph } from "@/components/ui";
import { DETECTOR_DEFAULTS } from "@/lib/detector-defaults";
import { TOOL_TYPE_GLYPHS } from "@/lib/tool-display";
import { isDetectorTool, type Tool, type ToolType } from "@/lib/types";

const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  function: "Function -- calls your own n8n webhook",
  transfer_call: "Transfer call -- silently transfers to a fixed number",
  record_lead_info: "Record lead info -- captures name/company/need into the call log",
  record_callback_number: "Record callback number -- captures a number to call back",
  detect_bot_call: "Detect bot call -- hangs up on answering machines and robocalls",
  detect_sales_call: "Detect sales call -- hangs up on cold pitches to us",
  end_call: "End call -- hangs up, on conditions you describe",
};

/** Detail pane for one tool in the global library -- either an existing row
 * (`tool` set) or the blank "create" form. Rendered on the right of
 * `ToolsLibraryPanel`'s tool list. Editing here affects every agent that has
 * this tool selected. */
export function ToolForm({ tool }: { tool?: Tool }) {
  const suffix = tool?.tool_id ?? "new";
  // Type is only choosable on create -- an existing tool's shape (webhook vs
  // destination number vs fixed native params) doesn't transform cleanly if
  // you change type after the fact, so it's fixed once created.
  const [toolType, setToolType] = useState<ToolType>(tool?.tool_type ?? "function");
  const isDetector = isDetectorTool(toolType);

  // An existing row's own values always win; the defaults are only for a
  // detector being created, so opening one of the seeded rows shows what it
  // actually has rather than what a new one would start with.
  const detectorDefaults = DETECTOR_DEFAULTS[toolType];
  const statementsValue = (
    tool?.detector_statements?.length
      ? tool.detector_statements
      : (detectorDefaults?.statements ?? [])
  ).join("\n");
  const descriptionValue =
    tool?.description || (isDetector ? (detectorDefaults?.description ?? "") : "");

  return (
    <ActionForm
      action={saveTool}
      submitLabel={tool ? "Update tool" : "Add tool"}
      pendingLabel="Saving…"
      footer={
        tool ? (
          <ActionButton
            action={deleteTool}
            label="Delete"
            variant="danger"
            confirm={`Delete the tool "${tool.name}"? Every agent that has it selected will stop being able to call it.`}
            hidden={{ tool_id: tool.tool_id }}
          />
        ) : undefined
      }
    >
      {tool && <input type="hidden" name="tool_id" value={tool.tool_id} />}
      <input type="hidden" name="tool_type" value={toolType} />

      <div className="space-y-5 rounded-lg border border-line bg-canvas-alt p-5">
        <div>
          <h3 className="font-heading text-sm font-semibold text-strong">Tool settings</h3>
          <p className="mt-1 text-xs text-muted">
            {isDetector
              ? "The model never sees this tool. The name is for your own reference in the library and the call log."
              : "What the model sees: the name it calls, and when it should call it."}
          </p>
        </div>

        <Field
          label="Tool type"
          htmlFor={`tool-type-${suffix}`}
          badge="required"
          hint="Fixed once created -- delete and recreate the tool if you need a different type."
        >
          {tool ? (
            <StaticValue>
              <span className="flex items-center gap-2">
                <ToolTypeGlyph
                  icon={TOOL_TYPE_GLYPHS[toolType].icon}
                  tone={TOOL_TYPE_GLYPHS[toolType].tone}
                  size="sm"
                />
                {TOOL_TYPE_LABELS[toolType]}
              </span>
            </StaticValue>
          ) : (
            <Dropdown
              id={`tool-type-${suffix}`}
              value={toolType}
              onValueChange={(next) => setToolType(next as ToolType)}
              options={(Object.entries(TOOL_TYPE_LABELS) as [ToolType, string][]).map(
                ([value, label]) => ({
                  value,
                  label: label.split(" -- ")[0],
                  description: label.split(" -- ")[1],
                  icon: TOOL_TYPE_GLYPHS[value].icon,
                  iconTone: TOOL_TYPE_GLYPHS[value].tone,
                }),
              )}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tool name"
            htmlFor={`tool-name-${suffix}`}
            badge="required"
            hint={
              isDetector
                ? "Identifier-safe. Appears in the call log against every call this detector ends."
                : "Identifier-safe. This is the function name the model calls."
            }
          >
            <Input
              id={`tool-name-${suffix}`}
              name="name"
              defaultValue={tool?.name ?? ""}
              placeholder={
                toolType === "transfer_call"
                  ? "transfer_to_sales"
                  : isDetector
                    ? "detect_sales_call"
                    : "book_calendar_slot"
              }
            />
          </Field>

          {toolType === "function" && (
            <Field
              label="n8n webhook URL"
              htmlFor={`tool-webhook-${suffix}`}
              badge="required"
              hint="Called with the tool's arguments as JSON; its response goes back into the conversation."
            >
              <Input
                id={`tool-webhook-${suffix}`}
                name="webhook_url"
                defaultValue={tool?.webhook_url ?? ""}
                placeholder="https://n8n.example.com/webhook/book-slot"
              />
            </Field>
          )}

          {toolType === "transfer_call" && (
            <Field
              label="Destination number"
              htmlFor={`tool-destination-${suffix}`}
              badge="required"
              hint="E.164 format. This tool always transfers to this one number -- create another Transfer call tool for a different destination."
            >
              <Input
                id={`tool-destination-${suffix}`}
                name="destination_number"
                defaultValue={tool?.destination_number ?? ""}
                placeholder="+15105550100"
              />
            </Field>
          )}
        </div>

        <Field
          label={isDetector ? "What counts as spam" : "When to use it"}
          htmlFor={`tool-description-${suffix}`}
          badge="required"
          hint={
            isDetector
              ? "Passed to the classifier alongside the statements below, so editing this changes what gets caught. Use it for patterns that are awkward to list as statements — spam shifts, and this is the quickest place to react."
              : "Written for the model, not for a person — this is the only thing it uses to decide whether to call the tool."
          }
        >
          <Textarea
            // Remounts when the type changes so a newly picked detector's
            // default guidance actually appears -- an uncontrolled textarea
            // keeps whatever it first rendered with otherwise.
            key={`description-${toolType}`}
            id={`tool-description-${suffix}`}
            name="description"
            rows={3}
            defaultValue={descriptionValue}
            placeholder={
              toolType === "transfer_call"
                ? "Transfer the caller to Sales when they want pricing, a quote, or a new project."
                : isDetector
                  ? "Also treat SEO, Google-listing and web-design pitches as sales calls, however politely they open."
                  : "This description will be used by the model to call the tools, you dont have to mention tools in the agent prompt!"
            }
          />
        </Field>

        {(toolType === "record_lead_info" ||
          toolType === "record_callback_number" ||
          toolType === "end_call") && (
          <p className="rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
            {toolType === "record_lead_info"
              ? "Fixed behavior: captures the caller's name, company, need, and qualification answers into this call's log -- not configurable beyond name and description."
              : toolType === "record_callback_number"
                ? "Fixed behavior: captures a callback number into this call's log, and into the transfer-failed alert -- not configurable beyond name and description."
                : // The description is the whole point of this type, so say what it
                  // does and doesn't control. The mechanics stay fixed because an
                  // admin overriding "speak your closing line first" produces calls
                  // cut off mid-word.
                  "Every agent can already hang up without this tool. Attach one to describe the conditions in your own words above -- the model reads a tool description on every turn, which carries more weight than the same sentence in the agent prompt. Your text is added to the built-in instructions (speak the closing line first, then hang up), not instead of them. Attaching this replaces the default end-call tool rather than adding a second one."}
          </p>
        )}
      </div>

      {isDetector && (
        <div className="space-y-5 rounded-lg border border-line bg-canvas-alt p-5">
          <div>
            <h3 className="font-heading text-sm font-semibold text-strong">Detection</h3>
            <p className="mt-1 text-xs text-muted">
              Checked against the caller&apos;s <strong>first reply only</strong>. A match ends the
              call immediately, with nothing spoken — so keep the statements narrow and widen them
              from what actually shows up in your call log.
            </p>
          </div>

          <Field
            label="Example statements"
            htmlFor={`tool-statements-${suffix}`}
            badge="required"
            hint={
              tool
                ? "One per line. Matched literally first (instant and free), then used as examples for the classifier. Partial lines work -- a statement matches if it appears anywhere in what the caller said."
                : "Prefilled with a starting set -- use them as they are, or edit them. One per line, matched literally first (instant and free), then used as examples for the classifier. Partial lines work: a statement matches if it appears anywhere in what the caller said."
            }
          >
            <Textarea
              key={`statements-${toolType}`}
              id={`tool-statements-${suffix}`}
              name="detector_statements"
              rows={8}
              defaultValue={statementsValue}
            />
          </Field>

          <Field
            label="Classifier model"
            htmlFor={`tool-detector-llm-${suffix}`}
            hint="Judges the cases the statements above don't match word-for-word. Leave on Gemini unless you have a reason -- DeepSeek measured ~1.6s per reply against Gemini Flash's ~450ms, and this runs while the caller is waiting."
          >
            <Dropdown
              id={`tool-detector-llm-${suffix}`}
              name="detector_llm"
              defaultValue={tool?.detector_llm ?? "gemini"}
              options={[
                {
                  value: "gemini",
                  label: "Gemini Flash",
                  description: "Fastest measured. The default.",
                },
                {
                  value: "deepseek",
                  label: "DeepSeek",
                  description: "Cheaper per token, noticeably slower to answer.",
                },
              ]}
            />
          </Field>

          <p className="rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
            This tool is never offered to the model as something it can choose to call — the worker
            checks it itself, so a caller can&apos;t talk their way past it. Two consequences worth
            knowing: it only ever looks at the first reply, so a pitch that opens with small talk
            gets through (use the agent&apos;s end-call instructions for those); and it needs a
            speech-to-text transcript, so it does not work on agents running Gemini Live.
          </p>
        </div>
      )}

      {toolType === "function" && (
        <div className="space-y-4 rounded-lg border border-line bg-canvas-alt p-5">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-strong">Parameters</h3>
            <span className="rounded-pill bg-surface px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-faint">
              Optional
            </span>
          </div>
          <ToolParameterBuilder
            fieldName="parameter_schema"
            initialSchema={tool?.parameter_schema ?? {}}
          />
        </div>
      )}
    </ActionForm>
  );
}
