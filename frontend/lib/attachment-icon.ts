import {
  BookOpen,
  File,
  FileArchive,
  FileCode,
  FileHeadphone,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideoCamera,
  Image,
  Link,
  Receipt,
  ShieldCheck,
} from "@lucide/vue";
import type { Component } from "vue";

type AttachmentLike = { type?: string; mimeType?: string; path?: string; title?: string };

/** Manuals, warranties, receipts and photos have their own icon whatever the file is. */
const BY_TYPE: Record<string, Component> = {
  manual: BookOpen,
  warranty: ShieldCheck,
  receipt: Receipt,
  photo: Image,
};

const EXTENSIONS: [Component, string[]][] = [
  [FileImage, ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "svg", "tif", "tiff"]],
  [FileVideoCamera, ["mp4", "mov", "m4v", "webm", "mkv", "avi"]],
  [FileHeadphone, ["mp3", "wav", "m4a", "aac", "ogg", "flac"]],
  [FileSpreadsheet, ["xls", "xlsx", "ods", "csv", "tsv", "numbers"]],
  [FileArchive, ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]],
  [FileCode, ["json", "xml", "yaml", "yml", "html", "htm", "js", "ts", "py", "sh"]],
  [FileText, ["pdf", "txt", "md", "rtf", "doc", "docx", "odt", "pages"]],
];

function extensionOf(name = "") {
  const clean = name.split(/[?#]/)[0] ?? "";
  const dot = clean.lastIndexOf(".");
  return dot > -1 ? clean.slice(dot + 1).toLowerCase() : "";
}

function byMime(mime: string): Component | null {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideoCamera;
  if (mime.startsWith("audio/")) return FileHeadphone;
  if (/spreadsheet|excel|csv/.test(mime)) return FileSpreadsheet;
  if (/zip|compressed|x-tar|gzip|x-7z|x-rar/.test(mime)) return FileArchive;
  if (/json|xml|javascript|yaml|html/.test(mime)) return FileCode;
  if (mime === "application/pdf" || mime.startsWith("text/") || /word|document|rtf/.test(mime)) return FileText;
  return null;
}

function isLink(a: AttachmentLike) {
  return a.mimeType === "link/url" || !!a.path?.startsWith("http://") || !!a.path?.startsWith("https://");
}

/**
 * The icon for an attachment: its type first (a warranty PDF shows a shield),
 * then for plain attachments a link, the MIME type, or the file extension.
 */
export function attachmentIcon(a: AttachmentLike): Component {
  const typed = a.type ? BY_TYPE[a.type] : undefined;
  if (typed) return typed;
  if (isLink(a)) return Link;
  const fromMime = a.mimeType ? byMime(a.mimeType.toLowerCase()) : null;
  if (fromMime) return fromMime;
  const ext = extensionOf(a.title) || extensionOf(a.path);
  return EXTENSIONS.find(([, exts]) => exts.includes(ext))?.[0] ?? File;
}
