# PDF generators

The handout PDFs are generated, not written by hand. The scripts live here so a
guide can be brought up to date by editing the script and re-running it, rather
than by rewriting a document nobody has the source of.

The PDFs themselves are **not** tracked — they are build output and they land in
the repo root, which is gitignored for them. Regenerate the one you need.

```bash
pip install reportlab
python scripts/pdf/guide.py
```

| Script | Produces | For |
|---|---|---|
| `guide.py` | `Second-Skool-Complete-Feature-Guide.pdf` | Every feature, per role. The main document. |
| `parents.py` | `Second-Skool-Parent-Guide.pdf` | What a parent sees and how to read it. |
| `roles.py` | `Second-Skool-Features-by-Role.pdf` | The head / teacher / student split, with diagrams. |
| `repo_pdf.py` | `Second-Skool-Source.pdf` | Every tracked text file in the repo, paginated. |

Shared modules, imported by `guide.py` and `parents.py`:

- `viz.py` — the palette plus the diagram primitives (`role_trio`, `flow`, `legend`).
- `screens.py` — the phone mockups (`phone_row`) and the tab bars they carry.

`render.py` is a check, not a generator: `python scripts/pdf/render.py <file.pdf>
<out-dir>` writes one PNG per page so a layout can be looked at.

## Two things to know before editing

Everything drawn in `roles.py` uses canvas primitives rather than glyphs, because
Helvetica in ReportLab is WinAnsi — an arrow or a rupee sign renders as a black
box. Arrows, ticks and crosses are vector paths. Verify against the **rendered**
page, never the source.

Every claim in these documents was taken from the running application. When the
app and a guide disagree, the app is right and the script needs updating.
