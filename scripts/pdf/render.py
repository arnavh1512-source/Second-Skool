import sys, os
import pypdfium2 as pdfium
src = sys.argv[1]
out = sys.argv[2]
pages = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
if not os.path.isdir(out):
    os.makedirs(out)
doc = pdfium.PdfDocument(src)
for i in range(len(doc)):
    if pages and (i + 1) not in pages:
        continue
    doc[i].render(scale=1.6).to_pil().save(os.path.join(out, 'p%02d.png' % (i + 1)))
print('rendered', len(doc), 'pages ->', out)
