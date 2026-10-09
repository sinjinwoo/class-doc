// Merges N individually-exported HWPX documents (from the *same* template,
// only field values differing) into one multi-section HWPX file — see
// docs/hwpx-merge-plan.md for the background and the zip/XML-level approach
// this implements (rejected alternatives: @rhwp/core's clipboard API is
// isolated per HwpDocument instance; insertTableRow() doesn't duplicate
// field controls into the new row).
//
// Verified both in that plan's original spike (a synthetic
// HwpDocument.createEmpty() doc, merged outside Node via raw zip
// manipulation) and re-verified here against this app's actual headless
// export pipeline with a real registered template
// (class-doc/template/템플릿 1.hwpx, containing real 클릭히어 필드 controls,
// not just plain text): header.xml/settings.xml/META-INF/mimetype/Preview
// are byte-identical across exports of the same template with only field
// values changed (setFieldValueByName never touches style/font/section
// structure), so the first document's copies of those are reused as-is —
// only each document's own Contents/section*.xml files differ and need
// copying in, with content.hpf's <opf:manifest>/<opf:spine> extended to
// declare them. Re-loading the merged bytes via @rhwp/core and calling
// pageCount()/renderPageSvg() on every page confirmed rhwp accepts the
// result as a valid multi-section document.
//
// NOT yet re-verified against a template containing tables/images (only a
// plain 클릭히어-필드-only template was available to test against) — see
// hwpx-merge-plan.md's still-open caveats (page numbering may reset per
// section; Preview/PrvImage.png only ever reflects the first document,
// harmless since headless export never used it anyway).
import JSZip from 'jszip'

const SECTION_HREF_RE = /^Contents\/section\d+\.xml$/

function parseManifestItems(hpf: string): Map<string, string> {
  const items = new Map<string, string>()
  const itemRe = /<opf:item\s+([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(hpf))) {
    const attrs = m[1]
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1]
    const href = /\bhref="([^"]*)"/.exec(attrs)?.[1]
    if (id && href) items.set(id, href)
  }
  return items
}

function parseSpineIdrefs(hpf: string): string[] {
  const idrefs: string[] = []
  const re = /<opf:itemref\s+([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(hpf))) {
    const idref = /\bidref="([^"]*)"/.exec(m[1])?.[1]
    if (idref) idrefs.push(idref)
  }
  return idrefs
}

/** Section file hrefs in document (spine) order — not zip-listing order, which isn't guaranteed to match. */
function listSectionHrefsInOrder(hpf: string): string[] {
  const items = parseManifestItems(hpf)
  return parseSpineIdrefs(hpf)
    .map((id) => items.get(id))
    .filter((href): href is string => href !== undefined && SECTION_HREF_RE.test(href))
}

/**
 * `buffers` must all be exports of the same template (only field values
 * differing) — the header/settings/manifest reuse below is only valid under
 * that assumption. A single buffer is returned as-is (no merge overhead for
 * the common "just one student" case).
 */
export async function mergeHwpxDocuments(buffers: Uint8Array[]): Promise<Uint8Array> {
  if (buffers.length === 0) {
    throw new Error('병합할 문서가 없습니다.')
  }
  if (buffers.length === 1) {
    return buffers[0]
  }

  const base = await JSZip.loadAsync(buffers[0])
  const baseHpfFile = base.file('Contents/content.hpf')
  if (!baseHpfFile) {
    throw new Error('병합 실패: 첫 번째 문서에서 Contents/content.hpf를 찾을 수 없습니다.')
  }
  let hpf = await baseHpfFile.async('string')
  let nextSectionIndex = listSectionHrefsInOrder(hpf).length

  for (let i = 1; i < buffers.length; i++) {
    const zip = await JSZip.loadAsync(buffers[i])
    const sourceHpfFile = zip.file('Contents/content.hpf')
    if (!sourceHpfFile) {
      throw new Error(`병합 실패: ${i + 1}번째 문서에서 Contents/content.hpf를 찾을 수 없습니다.`)
    }
    const sourceHpf = await sourceHpfFile.async('string')

    for (const href of listSectionHrefsInOrder(sourceHpf)) {
      const sectionFile = zip.file(href)
      if (!sectionFile) {
        throw new Error(`병합 실패: ${i + 1}번째 문서에서 ${href}를 찾을 수 없습니다.`)
      }
      const xml = await sectionFile.async('string')
      const newId = `section${nextSectionIndex}`
      const newHref = `Contents/section${nextSectionIndex}.xml`
      base.file(newHref, xml)
      hpf = hpf
        .replace(
          '</opf:manifest>',
          `<opf:item id="${newId}" href="${newHref}" media-type="application/xml"/></opf:manifest>`
        )
        .replace('</opf:spine>', `<opf:itemref idref="${newId}"/></opf:spine>`)
      nextSectionIndex += 1
    }
  }

  base.file('Contents/content.hpf', hpf)
  return base.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
