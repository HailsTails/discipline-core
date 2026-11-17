import { describe, expect, it } from "vitest";
import { changelogSectionOf, changelogWithSection } from "./changelog.ts";
import { changeEntryOf } from "./conventional-subject.ts";

describe("changelogSectionOf", () => {
  it("groups the changes under fixed headings in a fixed order, keeping their order within each", () => {
    expect(
      changelogSectionOf({
        version: "0.2.0",
        entries: [
          changeEntryOf({ subject: "chore: tidy the scripts (#30)" }),
          changeEntryOf({ subject: "fix(audit): read CRLF files (#31)" }),
          changeEntryOf({ subject: "feat(eslint)!: rename the plugin namespace (#32)" }),
          changeEntryOf({ subject: "feat: add a report output (#33)" }),
          changeEntryOf({ subject: "perf: cache the projection (#34)" }),
          changeEntryOf({ subject: "Keep versions out of the docs (#20)" }),
        ],
      }),
    ).toBe(
      "## 0.2.0\n\n### Breaking changes\n\n- eslint: rename the plugin namespace (#32)\n\n### Features\n\n- add a report output (#33)\n\n### Fixes\n\n- audit: read CRLF files (#31)\n- cache the projection (#34)\n\n### Other changes\n\n- tidy the scripts (#30)\n- Keep versions out of the docs (#20)\n",
    );
  });

  it("leaves out headings with no changes", () => {
    expect(changelogSectionOf({ version: "1.0.1", entries: [changeEntryOf({ subject: "fix: one" })] })).toBe("## 1.0.1\n\n### Fixes\n\n- one\n");
  });
});

describe("changelogWithSection", () => {
  const INTRO = "# Changelog\n\nIntro.\n";

  it("puts the new section above the newest one", () => {
    expect(changelogWithSection({ changelog: `${INTRO}\n## 0.1.0\n\nOld.\n`, version: "0.1.1", section: "## 0.1.1\n\nNew.\n" })).toEqual({
      outcome: "ok",
      value: `${INTRO}\n## 0.1.1\n\nNew.\n\n## 0.1.0\n\nOld.\n`,
    });
  });

  it("appends the section to a changelog with no sections yet", () => {
    expect(changelogWithSection({ changelog: INTRO, version: "0.1.0", section: "## 0.1.0\n\nNew.\n" })).toEqual({
      outcome: "ok",
      value: `${INTRO}\n## 0.1.0\n\nNew.\n`,
    });
  });

  it("refuses a version the changelog already has", () => {
    expect(changelogWithSection({ changelog: `${INTRO}\n## 0.1.1\n\nOld.\n`, version: "0.1.1", section: "## 0.1.1\n" })).toEqual({
      outcome: "failed",
      error: "CHANGELOG.md already has a section for 0.1.1",
    });
  });
});
