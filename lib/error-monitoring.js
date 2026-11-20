// The static site has no build step to inject production variables.
if (location.hostname === "pollyglot-topaz.vercel.app") {
  window.sentryOnLoad = function () {
    window.Sentry.init({
      environment: "production",
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend(event) {
        return {
          event_id: event.event_id,
          environment: event.environment,
          platform: event.platform,
          level: event.level,
          exception: {
            values: event.exception?.values?.map(exception => ({
              type: /^(TypeError|RangeError|ReferenceError|SyntaxError)$/.test(exception.type) ? exception.type : "Error",
              value: "Application exception",
              stacktrace: { frames: exception.stacktrace?.frames?.map(frame => ({
                filename: frame.filename?.split(/[?#]/)[0]?.match(/(?:^|\/)([\w.-]+\.js)$/)?.[1],
                lineno: frame.lineno, colno: frame.colno,
              })) },
            })),
          },
        };
      },
    });
  };
  const loader = document.createElement("script");
  loader.src = "https://js.sentry-cdn.com/ae9c5324112f33df48daa10d2c9a765a.min.js";
  loader.crossOrigin = "anonymous";
  document.head.appendChild(loader);
}
