# TeX Live com os pacotes dos documentos das frentes (construída uma vez; ver compilar-pdf.sh).
FROM texlive/texlive:latest-small
RUN tlmgr install inter fontawesome5 tcolorbox pgf environ trimspaces tikzfill pdfcol \
      enumitem fancyhdr lastpage needspace colortbl babel-portuguese multirow greek-fontenc ly1 fontaxes mweights xkeyval cbfonts-fd cbfonts psnfss >/dev/null 2>&1 || true \
 && kpsewhich ly1enc.def lgrenc.def inter.sty fontawesome5.sty tcolorbox.sty needspace.sty lastpage.sty
