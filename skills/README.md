# Installed agent skills

Third-party skill files, downloaded unmodified. They are here so an agent can
read them without network access. Do not edit them: `install.py --refresh`
overwrites every file.

| Directory | Upstream | License | Skills |
|---|---|---|---|
| `obra__superpowers` | https://github.com/obra/superpowers | MIT | 15 |
| `addyosmani__agent-skills` | https://github.com/addyosmani/agent-skills | MIT | 9 |
| `ultralytics__skills` | https://github.com/ultralytics/skills | AGPL-3.0 | 8 |
| `mattpocock__skills` | https://github.com/mattpocock/skills | MIT | 3 |
| `xcrrr__claude-skills` | https://github.com/xcrrr/claude-skills | MIT | 1 |
| `anthropics__skills` | https://github.com/anthropics/skills | **no license file** | 2 |

`anthropics__skills/` is **not committed**: upstream publishes no license, so
the files cannot be redistributed. Run `install.py` to fetch them locally.

Each upstream `LICENSE` sits next to its skills. The AGPL-3.0 skills are
documentation, not code linked into the app, but keep them unmodified and keep
the license file beside them.

## Commands

```powershell
python skills/install.py            # fetch anything missing
python skills/install.py --refresh  # re-download all 38
python skills/install.py --check    # verify against manifest.json
```

`manifest.json` records the upstream path, license, SHA-256 and size of every
installed file, so a silent upstream change is visible as a modified hash.

## Which skill for which task

`AGENTS.md` holds the task-to-skill table. Read it first. Short version:

- planning and process: `obra__superpowers/brainstorming`, `writing-plans`,
  `test-driven-development`, `systematic-debugging`,
  `verification-before-completion`
- API and frontend work: `addyosmani__agent-skills/*`
- anything under `backend/ai/`: `ultralytics__skills/yolo-datasets`,
  `yolo-training`, `yolo-tuning`, and `xcrrr__claude-skills/dataset-curator`
