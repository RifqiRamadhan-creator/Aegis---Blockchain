# IEEE Paper Draft (Aegis)

This folder contains the IEEE-style paper draft for the Aegis project.

## Build (PDF)

Use any LaTeX distribution that includes `IEEEtran` (e.g., TeX Live).

```cmd
cd "c:\Users\samm\Documents\Sam - Universitas Indonesia\S8\TekChain\Proj\Aegis---Blockchain\paper"
latexmk -pdf -interaction=nonstopmode main.tex
```

If `latexmk` is not available, use:

```cmd
pdflatex main.tex
pdflatex main.tex
```
