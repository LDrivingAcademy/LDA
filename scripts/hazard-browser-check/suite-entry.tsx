// Local software fixture only; never imported by application routes.
import { createRoot } from "react-dom/client";
import { TheoryTestSuite } from "../../src/components/theory-test-suite";
createRoot(document.getElementById("root")!).render(
  <TheoryTestSuite hazardVideoEnabled={new URLSearchParams(location.search).get("new") === "1"} />
);
