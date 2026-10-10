// Compatibility for existing package commands: this guard only observes.
// It never rewrites code, restarts deployments or makes commits.
import { runMonitor } from "./monitor-website.mjs";
await runMonitor();
