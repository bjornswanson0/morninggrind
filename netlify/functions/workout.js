/* Morning Grind — AI custom-workout generator (Netlify serverless function).
   Holds your Anthropic API key server-side (never shipped to the browser) and
   asks Claude to turn a free-form prompt into a structured workout.

   Setup: in Netlify → Site settings → Environment variables, add
     ANTHROPIC_API_KEY = sk-ant-...   (create one at console.anthropic.com)

   Model: Haiku 4.5 is the default because Netlify's synchronous functions time
   out at ~10s, and Haiku returns a full session in a few seconds for a fraction
   of a cent. Want higher-quality programming and don't mind the wait/cost? Swap
   MODEL to 'claude-sonnet-5' or 'claude-opus-4-8' below. */

const MODEL = 'claude-haiku-4-5';

const GROUPS = ['pressH','pressV','chestIso','latRaise','tricepsIso','core','squat','hinge',
  'lunge','hamIso','calf','pullV','rowH','rearDelt','bicepIso','condition','plyo','glute','mobility',''];

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'POST only' }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({
    error: 'The workout generator isn’t set up yet — add ANTHROPIC_API_KEY in Netlify → Site settings → Environment variables, then redeploy.' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const prompt = String(body.prompt || '').slice(0, 600).trim();
  if (!prompt) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Tell me what kind of workout you want.' }) };
  const maxes = (body.maxes && typeof body.maxes === 'object') ? body.maxes : {};

  const oneRM = Object.assign({ squat: 285, deadlift: 365, bench: 215, incline: 185, ohp: 130, row: 185 }, maxes);

  const system =
`You are an elite strength & hypertrophy coach programming ONE training session for Bjorn, inspired by Chris Bumstead's (CBum) classic-physique training style — controlled tempo, quality contractions, smart intensity.

Athlete profile:
- 158 lb, advanced lifter. Goal: hold ~158 lb and stay lean, mobile and nimble; muscle gain is a bonus.
- Access: full commercial gym (barbells, dumbbells, cables, machines) plus a pool, treadmills, and outdoor space for running.
- Sessions are 45–60 minutes.
- Estimated 1-rep maxes in lb: ${JSON.stringify(oneRM)}.

Rules:
- Program 5–8 exercises appropriate to the athlete's request.
- Prescribe concrete working loads in POUNDS derived from the 1RMs (e.g. "185", "60/side"). Use "BW" for bodyweight, "+25" for added weight, and for cardio/conditioning describe pace + duration (e.g. "6×30s hard / 90s easy").
- reps may be a number ("8") or a descriptor ("10-12", "12 min", "AMRAP", "60s").
- rpe is a number 6–10 as a string, or "-" for cardio/mobility.
- For each exercise, set group to the closest movement pool from this list so the app can offer swaps: ${GROUPS.filter(Boolean).join(', ')}. Use "" only if nothing fits.
- title: short and punchy. focus: one line on the session's aim. note: 1–2 sentences of coaching intent ("why this session").
Respect the athlete's request (soreness, time limits, equipment they want to avoid, muscle focus, cardio vs lifting). Return ONLY the structured workout.`;

  const schema = {
    type: 'object', additionalProperties: false,
    required: ['title', 'focus', 'note', 'exercises'],
    properties: {
      title: { type: 'string' },
      focus: { type: 'string' },
      note: { type: 'string' },
      exercises: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['name', 'sets', 'reps', 'load', 'rpe', 'group'],
          properties: {
            name: { type: 'string' },
            sets: { type: 'integer' },
            reps: { type: 'string' },
            load: { type: 'string' },
            rpe: { type: 'string' },
            group: { type: 'string', enum: GROUPS },
          },
        },
      },
    },
  };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return { statusCode: 502, headers: cors, body: JSON.stringify({ error: (data.error && data.error.message) || 'Claude API error.' }) };
    if (data.stop_reason === 'refusal') return { statusCode: 200, headers: cors, body: JSON.stringify({ error: 'That request was declined — try describing the workout differently.' }) };

    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let workout;
    try { workout = JSON.parse(txt); } catch { return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Could not read the workout — try again.' }) }; }
    return { statusCode: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(workout) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Network error reaching Claude — try again in a moment.' }) };
  }
};
