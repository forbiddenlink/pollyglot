const { LangfuseSpanProcessor } = require("@langfuse/otel");
const {
  LangfuseOtelSpanAttributes,
  setLangfuseTracerProvider,
  startObservation,
} = require("@langfuse/tracing");
const { context, ROOT_CONTEXT } = require("@opentelemetry/api");
const {
  AlwaysOnSampler,
  NodeTracerProvider,
} = require("@opentelemetry/sdk-trace-node");

/**
 * Langfuse (SDK v6, OpenTelemetry-based). Keeps the v3-shaped surface
 * (getLangfuse().trace(...).generation(...).end(...)) so api/index.js is
 * unchanged. Uses an isolated tracer provider so Langfuse never touches a
 * global OpenTelemetry provider.
 */

let processor = null;

function getProcessor() {
  if (processor) return processor;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secretKey || !publicKey) return null;

  processor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl:
      process.env.LANGFUSE_BASE_URL ||
      process.env.LANGFUSE_HOST ||
      "https://cloud.langfuse.com",
    environment: process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Serverless: export each span as it ends instead of batching.
    exportMode: "immediate",
  });
  setLangfuseTracerProvider(
    new NodeTracerProvider({
      sampler: new AlwaysOnSampler(),
      spanProcessors: [processor],
    }),
  );
  return processor;
}

function safe(fn) {
  try {
    return fn();
  } catch {
    // Tracing must never break the request.
    return undefined;
  }
}

const noopGeneration = { end() {} };
const noopTrace = { generation: () => noopGeneration };

function wrapGeneration(generation) {
  return {
    end(params = {}) {
      safe(() => {
        const usage = params.usage;
        const usageDetails = {};
        if (usage?.promptTokens !== undefined)
          usageDetails.input = usage.promptTokens;
        if (usage?.completionTokens !== undefined)
          usageDetails.output = usage.completionTokens;
        generation.update({
          ...(params.output !== undefined ? { output: params.output } : {}),
          ...(params.metadata ? { metadata: params.metadata } : {}),
          ...(Object.keys(usageDetails).length > 0 ? { usageDetails } : {}),
        });
        generation.end();
      });
    },
  };
}

function startTrace(params) {
  // Start from ROOT_CONTEXT so each trace is its own trace.
  const root = context.with(ROOT_CONTEXT, () =>
    startObservation(
      params.name,
      params.metadata ? { metadata: params.metadata } : {},
    ),
  );
  root.otelSpan.setAttributes({
    [LangfuseOtelSpanAttributes.TRACE_NAME]: params.name,
    ...Object.fromEntries(
      Object.entries(params.metadata ?? {}).map(([key, value]) => [
        `${LangfuseOtelSpanAttributes.TRACE_METADATA}.${key}`,
        typeof value === "string" ? value : JSON.stringify(value),
      ]),
    ),
  });
  // A v3 trace is a point-in-time record; children attach by trace id.
  root.end();

  return {
    generation(gen = {}) {
      const child = safe(() =>
        root.startObservation(
          gen.name,
          {
            ...(gen.model !== undefined ? { model: gen.model } : {}),
            ...(gen.input !== undefined ? { input: gen.input } : {}),
          },
          { asType: "generation" },
        ),
      );
      return child ? wrapGeneration(child) : noopGeneration;
    },
  };
}

const client = {
  trace(params) {
    if (!getProcessor()) return noopTrace;
    return safe(() => startTrace(params)) ?? noopTrace;
  },
};

function getLangfuse() {
  return getProcessor() ? client : null;
}

async function flushLangfuse() {
  if (processor) {
    await processor.forceFlush();
  }
}

module.exports = { getLangfuse, flushLangfuse };
