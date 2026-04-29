/**
 * Workflow entry: registers tasks. Start: node dist/workflow/entry.js
 */
import "./tasks/analyze-package-slice.js";
import "./tasks/analyze-repository.js";
import "./tasks/detect-blueprint.js";
import "./tasks/fetch-repo-snapshot.js";
import "./tasks/generate-blueprint.js";
import "./tasks/plan-targets.js";
import "./tasks/validate-yaml.js";
