import type { Skill, SkillAgentHandle } from '@wireassist/core';
import { loadWorkflow, parseSheetRef, parsePublishTarget } from '../context-loader';
import { applyWorkflowSettings } from '../workflow-settings';
import { getTrustStage } from '../trust-stage';
import { logRun } from '../run-log';
import type { DraftPostResult, RecentPost } from '../wordpress-client';
import { findBestMatch } from '../link-matcher';

export interface RunWorkflowInput {
  workflow: string;
  brief: string;
}

interface StageResult {
  stage: 'diagnose' | 'assemble' | 'take_action' | 'assess';
  content: string;
}

// DATA loop: Diagnose -> Assemble -> Take Action -> Assess
export const runWorkflowSkill: Skill<RunWorkflowInput, void> = {
  name: 'run_workflow',
  role: 'strategy',
  description: 'Run a named NixOps workflow through the DATA loop.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const workflow = applyWorkflowSettings(loadWorkflow(input.workflow), input.workflow);
    const priorRuns = await agent.loadContext(`workflow ${input.workflow}`);
    const stages: StageResult[] = [];

    // setTrustStage() keeps the workflow file's own "**Trust stage:**" line in
    // sync whenever JNix changes it via the dashboard, so this value and that
    // line always agree — this note just states it plainly up front so every
    // DATA-loop stage (including the final report) has it without re-parsing
    // the workflow file's markdown each time.
    const trustStage = getTrustStage(input.workflow);
    const trustStageNote =
      trustStage >= 3
        ? `CURRENT TRUST STAGE FOR THIS WORKFLOW: ${trustStage} (matches the workflow file's own "Trust stage" line — JNix advanced this workflow past Stage 2 via the dashboard). This run auto-delivers without human approval.`
        : `CURRENT TRUST STAGE FOR THIS WORKFLOW: ${trustStage} (matches the workflow file's own "Trust stage" line). This run requires human approval before delivery.`;

    const stage = async (
      name: StageResult['stage'],
      instruction: string,
      extra?: string
    ): Promise<string> => {
      const content = await agent.think(
        [
          `WORKFLOW FILE:\n${workflow}`,
          trustStageNote,
          `TASK BRIEF FROM JNIX:\n${input.brief}`,
          extra ? `PRIOR STAGES:\n${extra}` : '',
          `CURRENT STAGE — ${name.toUpperCase()}:\n${instruction}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        priorRuns || undefined
      );
      stages.push({ stage: name, content });
      agent.emit('agent:ops_stage_complete', {
        agentRole: task.agentRole,
        taskId: task.id,
        stage: name,
      });
      return content;
    };

    const transcript = () =>
      stages.map((s) => `### ${s.stage.toUpperCase()}\n${s.content}`).join('\n\n');

    // SOUL.md's Diagnose step: "Pull the current real state (inbox, sheet,
    // API, files)." A workflow file opts in with a "**Sheet:**" line
    // (see parseSheetRef); workflows without one just skip this.
    const sheetRef = parseSheetRef(workflow);
    let sheetContext = '';
    if (sheetRef) {
      try {
        const sheet = (await agent.useTool('sheets_read', {
          spreadsheetId: sheetRef.spreadsheetId,
          range: sheetRef.range,
        })) as { range: string; values: string[][] };
        sheetContext =
          `CURRENT SHEET STATE (${sheet.range}):\n` +
          (sheet.values.length > 0
            ? sheet.values.map((row) => row.join(' | ')).join('\n')
            : '(no rows)');
      } catch (err) {
        sheetContext =
          `SHEET READ FAILED for ${sheetRef.spreadsheetId} (${sheetRef.range}): ` +
          (err instanceof Error ? err.message : String(err)) +
          '\nTreat sheet-derived inputs as unavailable — do not assume stale/cached values.';
      }
    }

    const diagnosis = await stage(
      'diagnose',
      [
        'Check the workflow inputs against the brief. List unfilled TODOs or missing inputs.',
        'A workflow-level setting still showing a literal "_SETTING:_" placeholder in the ' +
          'WORKFLOW FILE above is a genuine gap, not something to fill in yourself — never ' +
          'invent a plausible-sounding value for it (a fake variant convention, a guessed cost, ' +
          'an imagined example listing). That always blocks. A per-run "_TODO:_" field the brief ' +
          "didn't address is different — proceed if it isn't essential to a correct result, per " +
          "the workflow file's own escalation rules.",
        sheetContext,
        'End with exactly one line: "VERDICT: PROCEED" if the workflow can run, or ' +
          '"VERDICT: BLOCKED — <reason>" if a required input is missing per the escalation rules. ' +
          'When blocking on a missing setting, name the exact label(s) verbatim (e.g. "Printify ' +
          'base costs") and say they can be filled in via the /ops page\'s "Workflow settings" ' +
          'panel — this reason is shown directly to JNix, so it must be specific enough to act on.',
      ]
        .filter(Boolean)
        .join('\n\n')
    );

    if (/VERDICT:\s*BLOCKED/i.test(diagnosis)) {
      task.output = { blocked: true, diagnosis };
      logRun(input.workflow, 'BLOCKED', `Brief: ${input.brief}\n\n${diagnosis}`);
      agent.emit('agent:ops_blocked', {
        agentRole: task.agentRole,
        taskId: task.id,
        diagnosis,
      });
      return;
    }

    await stage(
      'assemble',
      'Write the execution plan as a markdown checklist mapping each step to a Definition of Done item.',
      transcript()
    );

    await stage(
      'take_action',
      'Execute the plan: produce every artifact the Definition of Done requires, in full, ' +
        'as clearly separated markdown sections (one per artifact, titled with its filename).',
      transcript()
    );

    const assessment = await stage(
      'assess',
      'Grade the produced artifacts against every Definition of Done checkbox. Fix any gaps by ' +
        'restating the corrected artifact in full. Then give a run report: what was done, what was ' +
        'verified, unresolved items, and exactly one suggested improvement to the workflow file.',
      transcript()
    );

    // Trust stage 2 (default): nothing is delivered until JNix approves.
    // Stage 3+: this workflow has been explicitly advanced past that gate —
    // deliver without asking. Stage 3 vs 4 differ only in who triggers the
    // run (a human vs. an unattended cron); the code path is identical.
    // (trustStage was already read at the top of this skill so the model's
    // own prompt context stays in sync with this decision.)
    const autoApproved = trustStage >= 3;
    const approved = autoApproved
      ? true
      : await agent.proposeAction(task, 'deliver_workflow_output', {
          workflow: input.workflow,
          brief: input.brief,
          assessment,
        });

    // Only ever runs after a human (or trust-stage 3+) has already approved
    // delivery — publishing is additive to that gate, never a substitute
    // for it. A rejected run never reaches WordPress.
    let publishResult: DraftPostResult | undefined;
    let publishError: string | undefined;
    const publishTarget = approved ? parsePublishTarget(workflow) : null;
    if (publishTarget === 'wordpress') {
      try {
        // The assess stage only restates an artifact in full when it found
        // a gap to fix — a clean pass just reports "Pass" with no gap, and
        // the actual article body then only exists in the take_action
        // stage's output. Pass the full transcript so extraction always has
        // the real content regardless of whether assess had corrections.
        publishResult = await publishToWordPress(agent, transcript());
        agent.emit('agent:ops_published', {
          agentRole: task.agentRole,
          taskId: task.id,
          workflow: input.workflow,
          target: 'wordpress',
          result: publishResult,
        });
      } catch (err) {
        publishError = err instanceof Error ? err.message : String(err);
        agent.emit('agent:ops_publish_failed', {
          agentRole: task.agentRole,
          taskId: task.id,
          workflow: input.workflow,
          target: 'wordpress',
          error: publishError,
        });
      }
    }

    task.output = {
      workflow: input.workflow,
      approved,
      autoApproved,
      transcript: transcript(),
      ...(publishResult ? { publish: publishResult } : {}),
      ...(publishError ? { publishError } : {}),
    };

    const outcomeLabel = autoApproved ? 'AUTO-APPROVED' : approved ? 'APPROVED' : 'REJECTED';
    const publishLabel = publishResult
      ? `\n\nPublished as WordPress draft: ${publishResult.editLink}`
      : publishError
        ? `\n\nWordPress publish failed: ${publishError}`
        : '';

    // Full transcript, not a truncated summary — this is the only place the
    // run's actual deliverables survive once the task itself is discarded.
    agent.remember(
      `NixOps run of "${input.workflow}" (${outcomeLabel}). Brief: ${input.brief}.\n\n${transcript()}${publishLabel}`,
      ['ops-run', input.workflow]
    );
    logRun(input.workflow, outcomeLabel, `Brief: ${input.brief}\n\n${transcript()}${publishLabel}`);

    agent.emit('agent:ops_run_complete', {
      agentRole: task.agentRole,
      taskId: task.id,
      workflow: input.workflow,
      approved,
      autoApproved,
      transcript: transcript(),
      publish: publishResult,
      publishError,
    });
  },
};

// Extracts the final, corrected artifacts from the full run transcript
// into a structured payload and pushes them to WordPress as a draft. A
// second, narrowly-scoped `think()` call rather than trying to regex-parse
// the DATA loop's free-form markdown sections — the model already
// produced the content, this just asks it to re-emit the relevant parts
// as JSON. Needs the FULL transcript, not just the assess stage: assess
// only restates an artifact when it found a gap, so a clean run's actual
// article body only exists in take_action's output.
//
// Images and internal links are resolved with real data AFTER extraction,
// in plain code, not by the model: image prompts get generated and
// uploaded, and internal-link candidates get matched against the site's
// actual post list (see link-matcher.ts). This keeps the model from ever
// inventing a URL that doesn't exist — a match either comes from a real
// WordPress post or the link doesn't happen.
async function publishToWordPress(
  agent: SkillAgentHandle,
  fullTranscript: string
): Promise<DraftPostResult> {
  const extraction = await agent.think(
    [
      'Extract the FINAL, CORRECTED version of the article and its metadata from the run',
      'transcript below into a single JSON object — no markdown fences, no commentary, JSON only.',
      'The transcript has four sections: DIAGNOSE, ASSEMBLE, TAKE_ACTION, and ASSESS. TAKE_ACTION',
      'has the article and meta package as originally written. ASSESS only restates an artifact in',
      'full when it found a gap to fix — if ASSESS shows a corrected version of something, use',
      "that version; for anything ASSESS didn't restate (a clean pass), use the TAKE_ACTION version.",
      '',
      'Convert the article body from markdown to clean semantic HTML: <h2>/<h3> for headings',
      '(the H1 becomes the "title" field instead, do not repeat it in the body), <p> for',
      'paragraphs, <ul>/<ol> for lists, <strong>/<em> for emphasis.',
      '',
      'For each [IMAGE SUGGESTION: ...] marker, replace it in the HTML with a bare token',
      '{{IMG:0}}, {{IMG:1}}, etc. (in order of appearance), and list the original suggestion',
      'text as a generation prompt in "imagePrompts" at the matching index.',
      '',
      'For each [INTERNAL LINK: anchor text → page type] marker, replace it in the HTML with',
      'a bare token {{LINK:0}}, {{LINK:1}}, etc., and add an entry to "internalLinkCandidates"',
      'with that token, the anchor text, and a short topic phrase (a few words capturing what',
      'the linked page should be about, e.g. "GPU buying guide budget") that can be matched',
      'against real post titles. Do not invent or guess a URL yourself.',
      '',
      'For [EXTERNAL LINK: ...] markers, keep the existing behavior: `<a href="#">` with the',
      'anchor text and the marker itself in the title attribute, for JNix to fix before publishing.',
      '',
      'Also propose 1-3 short YouTube search queries ("youtubeSearchQueries") that would find a',
      'genuinely relevant video for this article’s topic — skip this if the topic has no natural',
      'video angle rather than forcing an unrelated query.',
      '',
      'Required JSON shape:',
      '{',
      '  "title": "the article H1 / working title",',
      '  "slug": "url-slug-from-meta",',
      '  "metaTitle": "title tag from the meta package",',
      '  "metaDescription": "meta description from the meta package",',
      '  "excerpt": "a 1-2 sentence summary suitable as a WordPress excerpt",',
      '  "contentHtml": "the full article body as HTML, with {{IMG:n}} / {{LINK:n}} tokens",',
      '  "imagePrompts": ["prompt for IMG:0", "prompt for IMG:1"],',
      '  "internalLinkCandidates": [{"token": "LINK:0", "anchorText": "...", "topic": "..."}],',
      '  "youtubeSearchQueries": ["...", "..."]',
      '}',
      '',
      `FULL RUN TRANSCRIPT:\n${fullTranscript}`,
    ].join('\n'),
    undefined,
    // The agent's default maxTokens (8192) is sized for the four DATA-loop
    // stages, not for re-emitting a full article as HTML inside one JSON
    // blob — that alone can approach 8192 before the JSON structure and
    // link/image metadata are even counted, causing silent truncation.
    16000
  );

  const stripped = extraction
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: {
    title: string;
    slug?: string;
    metaTitle?: string;
    metaDescription?: string;
    excerpt?: string;
    contentHtml: string;
    imagePrompts?: string[];
    internalLinkCandidates?: Array<{ token: string; anchorText: string; topic: string }>;
    youtubeSearchQueries?: string[];
  };
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // A response that doesn't end with '}' almost always means it hit
    // the token limit mid-output, not that the model wrote malformed
    // JSON — worth saying plainly rather than making every truncation
    // look like a formatting bug.
    const likelyTruncated = !stripped.endsWith('}');
    throw new Error(
      `WordPress publish extraction returned unparseable JSON` +
        (likelyTruncated ? ' (likely truncated — response did not end with "}")' : '') +
        `. Length: ${stripped.length}. Tail: ${stripped.slice(-500)}`
    );
  }

  let contentHtml = parsed.contentHtml;
  let featuredMediaId: number | undefined;

  // ── Images: generate via Pollinations, upload to WP media library ──
  for (const [i, prompt] of (parsed.imagePrompts ?? []).entries()) {
    const token = `{{IMG:${i}}}`;
    try {
      const generated = (await agent.useTool('image_generate', { prompt })) as {
        imageBase64: string;
        mimeType: string;
      };
      const ext = generated.mimeType.includes('png') ? 'png' : 'jpg';
      const uploaded = (await agent.useTool('wordpress_upload_media', {
        imageBase64: generated.imageBase64,
        mimeType: generated.mimeType,
        filename: `seo-article-image-${i}.${ext}`,
        altText: prompt,
      })) as { id: number; sourceUrl: string };
      if (i === 0) featuredMediaId = uploaded.id;
      contentHtml = contentHtml.replace(
        token,
        `<img src="${uploaded.sourceUrl}" alt="${prompt.replace(/"/g, '')}" />`
      );
    } catch {
      // Image generation/upload is best-effort — fall back to the plain
      // suggestion text rather than leaving a raw {{IMG:n}} token or
      // failing the whole publish over one bad image.
      contentHtml = contentHtml.replace(token, `[IMAGE SUGGESTION: ${prompt}]`);
    }
  }

  // ── Internal links: match against real posts, never invent a URL ──
  if (parsed.internalLinkCandidates?.length) {
    let posts: RecentPost[] = [];
    try {
      posts = (await agent.useTool('wordpress_list_posts', {})) as RecentPost[];
    } catch {
      // No post list available — every candidate falls through to plain
      // text below, same as a candidate with no match.
    }
    for (const candidate of parsed.internalLinkCandidates) {
      const token = `{{${candidate.token}}}`;
      const match = posts.length ? findBestMatch(candidate.topic, posts) : null;
      contentHtml = contentHtml.replace(
        token,
        match ? `<a href="${match.link}">${candidate.anchorText}</a>` : candidate.anchorText
      );
    }
  }

  // ── YouTube: search, then one small judgment call to pick (or skip) ──
  if (parsed.youtubeSearchQueries?.length) {
    try {
      const seen = new Set<string>();
      const candidates: Array<{ title: string; channelTitle: string; url: string }> = [];
      for (const query of parsed.youtubeSearchQueries.slice(0, 3)) {
        const results = (await agent.useTool('youtube_search_videos', {
          query,
          maxResults: 5,
        })) as Array<{ videoId: string; title: string; channelTitle: string; url: string }>;
        for (const r of results) {
          if (!seen.has(r.videoId)) {
            seen.add(r.videoId);
            candidates.push(r);
          }
        }
        if (candidates.length >= 5) break;
      }

      if (candidates.length) {
        const pick = await agent.think(
          [
            `The article is titled "${parsed.title}".`,
            'From the candidate videos below, pick the single most relevant, appropriate one to',
            'embed — prefer official manufacturer/reviewer channels over channels that look like',
            'competing publications or low-quality content. If nothing genuinely fits, say NONE.',
            'Reply with exactly one line: either the chosen video’s URL, or the word NONE.',
            '',
            candidates.map((c) => `- ${c.title} (${c.channelTitle}): ${c.url}`).join('\n'),
          ].join('\n')
        );
        const chosenUrl = candidates.find((c) => pick.includes(c.url))?.url;
        if (chosenUrl) {
          contentHtml += `\n<h2>Related Video</h2>\n<p>${chosenUrl}</p>`;
        }
      }
    } catch {
      // No YouTube credentials configured yet, or the search failed —
      // skip the video entirely rather than fail the publish.
    }
  }

  return agent.useTool('wordpress_publish_draft', {
    title: parsed.title,
    slug: parsed.slug,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    excerpt: parsed.excerpt,
    contentHtml,
    featuredMediaId,
  }) as Promise<DraftPostResult>;
}
