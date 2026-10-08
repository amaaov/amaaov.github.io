(function () {
  var api = null;
  if (typeof document !== "undefined" && document.modelContext) {
    api = document.modelContext;
  } else if (typeof navigator !== "undefined" && navigator.modelContext) {
    api = navigator.modelContext;
  }
  if (!api || typeof api.registerTool !== "function") return;

  var controller = new AbortController();
  var origin = window.location.origin;

  function go(path) {
    window.location.href = new URL(path, origin).href;
    return { ok: true, href: new URL(path, origin).href };
  }

  var tools = [
    {
      name: "open_home",
      description: "Open the amaaov homepage with contacts and internet evidence.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: function () { return go("/"); }
    },
    {
      name: "open_articles",
      description: "Open the articles index of essays and programmes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: function () { return go("/pages.html"); }
    },
    {
      name: "open_demos",
      description: "Open the interactive demos index.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: function () { return go("/demos.html"); }
    },
    {
      name: "open_llms_txt",
      description: "Open the plain-text LLM index of pages.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: function () { return go("/llms.txt"); }
    }
  ];

  for (var t = 0; t < tools.length; t++) {
    try {
      var result = api.registerTool(tools[t], { signal: controller.signal });
      if (result && typeof result.then === "function") {
        result.catch(function () {});
      }
    } catch (err) {
      // WebMCP is optional; ignore unsupported shapes.
    }
  }

  window.addEventListener("pagehide", function () {
    controller.abort();
  }, { once: true });
})();
