import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { SECTION_TITLES_ID, type CvData, type SectionKey } from "@/lib/cvTypes";

const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : "0F172A");
const lines = (t: string) => t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/**
 * CV → .docx yang bisa diedit di Word/Google Docs. Murni teks terstruktur
 * (judul bagian, daftar bullet) — format paling ramah ATS. Urutan & judul bagian
 * mengikuti pengaturan "Susunan" yang sama dengan PDF.
 */
export async function buildCvDocxBlob(data: CvData): Promise<Blob> {
  const accent = hex(data.accentColor);
  const font = data.fontFamily?.trim() || "Calibri";
  const titles: Record<SectionKey, string> = { ...SECTION_TITLES_ID };
  for (const [k, v] of Object.entries(data.sectionTitles || {})) if (typeof v === "string" && v.trim()) titles[k as SectionKey] = v.trim();
  const hidden = new Set(data.hiddenSections);
  const kids: Paragraph[] = [];

  const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
    new TextRun({ text, font, bold: o.bold, italics: o.italics, size: o.size ?? 21, color: o.color });
  const heading = (t: string) =>
    kids.push(
      new Paragraph({
        spacing: { before: 260, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
        children: [run(t.toUpperCase(), { bold: true, size: 23, color: accent })],
      })
    );
  const bullets = (text: string) =>
    lines(text).forEach((l) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(l)] })));
  const entry = (title: string, period: string, sub: string) => {
    kids.push(
      new Paragraph({
        spacing: { before: 120, after: 20 },
        children: [run(title || "-", { bold: true, size: 22 }), ...(period ? [run(`   |   ${period}`, { color: "64748B", size: 20 })] : [])],
      })
    );
    if (sub.trim()) kids.push(new Paragraph({ spacing: { after: 40 }, children: [run(sub, { italics: true, color: "475569" })] }));
  };

  kids.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [run(data.fullName || "Nama Lengkap", { bold: true, size: 40, color: "0F172A" })] }));
  if (data.jobTitle.trim()) kids.push(new Paragraph({ spacing: { after: 40 }, children: [run(data.jobTitle, { bold: true, size: 26, color: accent })] }));
  const contact = [data.email, data.phone, data.address, data.website, ...lines(data.extraInfo || "")].map((s) => s.trim()).filter(Boolean);
  if (contact.length) kids.push(new Paragraph({ spacing: { after: 60 }, children: [run(contact.join("  |  "), { color: "475569", size: 20 })] }));

  for (const key of data.sectionOrder) {
    if (hidden.has(key)) continue;
    switch (key) {
      case "summary":
        if (!data.summary.trim()) break;
        heading(titles.summary);
        kids.push(new Paragraph({ children: [run(data.summary.trim())] }));
        break;
      case "skills": {
        const n = data.skills.filter((s) => s.name.trim()).map((s) => s.name.trim());
        if (!n.length) break;
        heading(titles.skills);
        kids.push(new Paragraph({ children: [run(n.join("  •  "))] }));
        break;
      }
      case "languages": {
        const n = data.languages.filter((l) => l.name.trim()).map((l) => `${l.name.trim()}${l.level ? ` (${l.level})` : ""}`);
        if (!n.length) break;
        heading(titles.languages);
        kids.push(new Paragraph({ children: [run(n.join("  •  "))] }));
        break;
      }
      case "experience": {
        const it = data.experience.filter((e) => e.role.trim() || e.company.trim());
        if (!it.length) break;
        heading(titles.experience);
        it.forEach((e) => {
          entry([e.role, e.location].filter(Boolean).join(" — "), e.period, e.company);
          bullets(e.description);
        });
        break;
      }
      case "education": {
        const it = data.education.filter((e) => e.degree.trim() || e.school.trim());
        if (!it.length) break;
        heading(titles.education);
        it.forEach((e) => {
          entry(e.degree, e.period, e.school);
          bullets(e.description);
        });
        break;
      }
      case "projects": {
        const it = data.projects.filter((p) => p.name.trim());
        if (!it.length) break;
        heading(titles.projects);
        it.forEach((p) => {
          entry(p.name, p.period, [p.role, p.link].filter(Boolean).join("  |  "));
          bullets(p.description);
        });
        break;
      }
      case "certifications": {
        const it = data.certifications.filter((c) => c.name.trim());
        if (!it.length) break;
        heading(titles.certifications);
        it.forEach((c) => entry(c.name, c.year, c.issuer));
        break;
      }
      case "achievements": {
        const it = data.achievements.filter((a) => a.title.trim());
        if (!it.length) break;
        heading(titles.achievements);
        it.forEach((a) => {
          entry(a.title, a.period, a.org);
          bullets(a.description);
        });
        break;
      }
      case "interests": {
        const list = (data.interests || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        if (!list.length) break;
        heading(titles.interests);
        kids.push(new Paragraph({ children: [run(list.join("  •  "))] }));
        break;
      }
      case "references": {
        const it = data.references.filter((r) => r.name.trim());
        if (!it.length) break;
        heading(titles.references);
        it.forEach((r) => entry(r.name, "", [r.position, r.contact].filter(Boolean).join("  |  ")));
        break;
      }
      case "custom":
        if (!data.customBody.trim()) break;
        heading(data.customTitle.trim() || titles.custom);
        bullets(data.customBody);
        break;
    }
  }

  const doc = new Document({
    creator: "Gamato Piranti",
    title: `CV ${data.fullName}`.trim(),
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: kids }],
  });
  return Packer.toBlob(doc);
}
