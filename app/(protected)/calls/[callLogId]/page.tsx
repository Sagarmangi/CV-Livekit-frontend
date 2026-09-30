import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  ButtonLink,
  CallStatusBadge,
  Card,
  Duration,
  Money,
  Mono,
  OutcomeBadge,
  PageBody,
  PageHeader,
  PriorityBadge,
  Table,
  Td,
  Th,
  Timestamp,
} from "@/components/ui";
import { getAgent, getCallLog } from "@/lib/queries";
import { ENDED_BY_LABELS } from "@/lib/types";

const COMPONENT_LABELS: Record<string, string> = {
  stt: "Speech-to-text",
  llm: "Conversation engine",
  tts: "Text-to-speech",
  telephony: "Telephony",
};

/** The slugs the worker writes today, in the words a person would use.
 * Deliberately a lookup with a fallback rather than an exhaustive map: the
 * worker is free to add reasons (`shutdown: …` carries arbitrary text), and an
 * unknown slug should still be readable rather than rendering as blank. */
const END_REASON_LABELS: Record<string, string> = {
  end_call_tool: "the agent ended the call",
  transferred: "the call was transferred",
  caller_hung_up: "the caller hung up",
  // The disconnect arrived without a reason attached, so this is our inference,
  // not LiveKit's word. Says so rather than reading as a confirmed hangup.
  caller_hung_up_unconfirmed: "the caller left — reason not reported",
  spam_filter: "the spam filter dropped it",
  sip_trunk_failure: "the SIP trunk failed",
  connection_timeout: "the connection timed out",
  media_failure: "the audio connection failed",
  user_unavailable: "the caller did not answer",
  user_rejected: "the caller rejected the call",
  signal_close: "the connection closed",
  server_shutdown: "the media server shut down",
};

function endReasonLabel(reason: string): string {
  return END_REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

export default async function CallDetailPage({
  params,
}: PageProps<"/calls/[callLogId]">) {
  const { callLogId } = await params;

  const call = await getCallLog(callLogId);
  if (!call) notFound();

  const agent = call.agent_id ? await getAgent(call.agent_id) : null;

  return (
    <PageBody>
      <PageHeader
        title="Call detail"
        actions={<ButtonLink href="/calls">All calls</ButtonLink>}
      />

      <Card title="Summary">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="When">
            <Timestamp value={call.created_at} />
          </Detail>
          <Detail label="Source">
            {call.is_test ? (
              <Badge tone="blue">Web call</Badge>
            ) : (
              "Phone call"
            )}
          </Detail>
          <Detail label="Caller">
            {call.is_test ? (
              <span className="text-faint">no phone number — browser test</span>
            ) : call.caller_number ? (
              <Mono>{call.caller_number}</Mono>
            ) : (
              "unknown"
            )}
          </Detail>
          <Detail label="Duration">
            <Duration seconds={call.duration_seconds} />
          </Detail>
          <Detail label="Outcome">
            <OutcomeBadge outcome={call.outcome} />
          </Detail>
          <Detail label="Cost">
            <Money usd={call.cost_total_usd} />
          </Detail>
          <Detail label="Agent">
            {agent ? (
              <Link
                href={`/agents/${agent.agent_id}`}
                className="font-medium text-brand-deep underline-offset-2 hover:underline dark:text-brand"
              >
                {agent.name}
              </Link>
            ) : (
              "—"
            )}
          </Detail>
          <Detail label="Transferred to">
            {call.matched_department ?? "—"}
          </Detail>
          <Detail label="Lead name">{call.lead_name ?? "—"}</Detail>
          <Detail label="Company">{call.lead_company ?? "—"}</Detail>
          <Detail label="Number dialled">
            {call.called_number ? <Mono>{call.called_number}</Mono> : "—"}
          </Detail>
          <Detail label="Twilio call SID">
            {call.call_sid ? <Mono>{call.call_sid}</Mono> : "—"}
          </Detail>
          <Detail label="LiveKit room">
            {call.room_id ? <Mono>{call.room_id}</Mono> : "—"}
          </Detail>
        </dl>

        {call.spam_detection && (
          // The caller was hung up on with no explanation, so this is the only
          // account of why. Given its own block rather than a table cell because
          // reading it is how a wrongly-dropped customer gets noticed -- and it
          // names the tool, so the statement list behind it can be narrowed.
          <div className="mt-6 border-t border-divider pt-5">
            <dt className="mono-kicker">Ended by spam detection</dt>
            <dd className="mt-1 text-sm">
              {call.spam_detection}
              <p className="mt-1.5 text-xs text-muted">
                If this caller was legitimate, edit the statements or description on that
                tool in <Link href="/tools" className="underline underline-offset-2">Tools</Link>.
              </p>
            </dd>
          </div>
        )}

        {call.lead_need && (
          <div className="mt-6 border-t border-divider pt-5">
            <dt className="mono-kicker">
              What they need
            </dt>
            <dd className="mt-1 text-sm">{call.lead_need}</dd>
          </div>
        )}
      </Card>

      {(call.call_status ||
        call.priority ||
        call.call_summary ||
        call.has_error ||
        call.ended_by ||
        (call.user_queries && call.user_queries.length > 0)) && (
        <Card
          title="Call analysis"
          description="Written after the call ended, never during it. Status, who ended the call, transfer and callback are observed from what the session actually did. Caller name, summary, requests and priority are inferred from the transcript by the model named on the badge — the caller name in particular is a guess, where LEAD NAME above is captured by a tool during the call."
        >
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Caller name">
              {call.caller_name ? (
                <span className="flex flex-wrap items-center gap-2">
                  {call.caller_name}
                  {/* Attributed rather than presented as fact. This name was
                      inferred from a transcript, unlike LEAD NAME in Summary
                      which the record_lead_info tool captured during the call.
                      Anyone acting on it should know which they're looking at. */}
                  <Badge tone="blue">
                    {call.analysis_model ?? "analysis"}
                  </Badge>
                </span>
              ) : (
                <span className="text-faint">not stated</span>
              )}
            </Detail>
            <Detail label="Status">
              <CallStatusBadge status={call.call_status} />
            </Detail>
            <Detail label="Ended by">
              {call.ended_by ? (
                <span className="flex flex-col gap-0.5">
                  {ENDED_BY_LABELS[call.ended_by]}
                  {call.end_reason && (
                    <span className="text-xs text-faint">
                      {endReasonLabel(call.end_reason)}
                    </span>
                  )}
                </span>
              ) : (
                // Not "unknown" — that is a value the worker can actually
                // record. This is a call from before any of it was tracked.
                <span className="text-faint">not recorded</span>
              )}
            </Detail>
            <Detail label="Priority">
              <PriorityBadge priority={call.priority} />
            </Detail>
            <Detail label="Transfer attempted">
              {call.transfer_attempted === null
                ? "—"
                : call.transfer_attempted
                  ? "Yes"
                  : "No"}
            </Detail>
            <Detail label="Callback needed">
              {call.callback_needed === null
                ? "—"
                : call.callback_needed
                  ? "Yes"
                  : "No"}
            </Detail>
          </dl>

          {call.has_error && (
            // The session broke mid-call. Until this was recorded it lived only
            // in the worker's stdout, on another machine — so a call that went
            // wrong looked identical to one that went fine.
            <div className="mt-6 border-t border-divider pt-5">
              <dt className="mono-kicker">Session error</dt>
              <dd className="mt-1 text-sm">
                {call.error_message ?? "An error occurred but no detail was recorded."}
              </dd>
            </div>
          )}

          {call.call_summary && (
            <div className="mt-6 border-t border-divider pt-5">
              <dt className="mono-kicker">Summary</dt>
              <dd className="mt-1 text-sm leading-relaxed">{call.call_summary}</dd>
            </div>
          )}

          {call.user_queries && call.user_queries.length > 0 && (
            <div className="mt-6 border-t border-divider pt-5">
              <dt className="mono-kicker">What the caller asked for</dt>
              <dd className="mt-1">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {call.user_queries.map((query, i) => (
                    <li key={i}>{query}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </Card>
      )}

      {call.cost_breakdown && call.cost_breakdown.lines.length > 0 && (
        <Card
          title="Cost breakdown"
          description="What each platform charged for this call, at the rates in effect when it ended. Stored per call rather than recomputed, so a later price change can't rewrite history."
        >
          <Table>
            <thead>
              <tr>
                <Th>Platform</Th>
                <Th>Model</Th>
                <Th className="text-right">Used</Th>
                <Th className="text-right">Rate</Th>
                <Th className="text-right">Cost</Th>
              </tr>
            </thead>
            <tbody>
              {call.cost_breakdown.lines.map((line, i) => (
                <tr key={`${line.component}-${line.model}-${i}`}>
                  <Td>
                    {COMPONENT_LABELS[line.component] ?? line.component}
                    {line.component === "telephony" && (
                      <div className="text-xs text-muted">estimated</div>
                    )}
                  </Td>
                  <Td>
                    <Mono>{line.model}</Mono>
                    <div className="text-xs text-muted">{line.provider}</div>
                  </Td>
                  <Td className="text-right text-muted whitespace-nowrap">
                    {line.quantity.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                    <div className="text-xs text-faint">{line.unit}</div>
                  </Td>
                  <Td className="text-right text-muted whitespace-nowrap">
                    {line.rate_usd === null ? (
                      <span className="text-faint">no rate set</span>
                    ) : (
                      `$${line.rate_usd}`
                    )}
                  </Td>
                  <Td className="text-right">
                    <Money usd={line.cost_usd} />
                  </Td>
                </tr>
              ))}
              <tr>
                <Td className="font-medium">Total</Td>
                <Td />
                <Td />
                <Td />
                <Td className="text-right font-medium">
                  <Money usd={call.cost_total_usd} />
                </Td>
              </tr>
            </tbody>
          </Table>

          <p className="mt-4 text-xs text-muted">
            Speech-to-text, the conversation engine and text-to-speech are priced
            from metered usage — token counts come from the model provider&apos;s
            own response. Telephony is not metered here: Twilio bills the account
            directly and the worker has no access to that figure, so it is
            duration multiplied by a configured rate. Text-to-speech runs slightly
            high on calls where the agent was interrupted mid-sentence, since the
            character count includes text that was never sent to the provider.
          </p>
        </Card>
      )}

      {call.recording_url && (
        <Card title="Recording">
          <audio controls src={call.recording_url} className="w-full">
            <a href={call.recording_url}>Download the recording</a>
          </audio>
        </Card>
      )}

      <Card title="Transcript">
        {call.transcript ? (
          <pre className="max-h-[32rem] overflow-auto rounded-md bg-canvas-alt p-4 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
            {call.transcript}
          </pre>
        ) : (
          <p className="text-sm text-muted">
            No transcript was recorded for this call.
          </p>
        )}
      </Card>
    </PageBody>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mono-kicker">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
