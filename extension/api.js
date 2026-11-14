import { request } from "./auth.js";
export function detect(raw) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    const h = u.hostname.replace(/^www\./, "");
    let id;
    if (h === "youtu.be") id = u.pathname.split("/")[1];
    else if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(h))
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : u.pathname.match(/^\/(shorts|live)\/([\w-]{11})\/?$/)?.[2];
    if (/^[\w-]{11}$/.test(id || ""))
      return {
        platform: "YouTube",
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    if (["instagram.com", "m.instagram.com"].includes(h)) {
      const m = u.pathname.match(/^\/(reels?|p|tv)\/([\w-]+)\/?$/);
      if (m)
        return {
          platform: "Instagram",
          url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/`,
        };
    }
  } catch {}
  return null;
}
const rest = (s, path, options) =>
  request("/rest/v1/" + path, options, s.access_token);
const fn = (s, name, body) =>
  request(
    "/functions/v1/" + name,
    { method: "POST", body: JSON.stringify(body) },
    s.access_token,
    name === "classify-video" ? 32000 : 10000,
  );
export const folders = (s) =>
  rest(s, "folders?select=id,name,parent_id&order=name");
export async function saveVideo(
  s,
  raw,
  notes,
  folder,
  tabTitle,
  progress = () => {},
) {
  const d = detect(raw);
  if (!d) throw Error("Enter a supported video URL.");
  const q = new URLSearchParams({
    select: "id",
    url: `in.(${JSON.stringify(d.url)},${JSON.stringify(raw)})`,
  });
  progress("Checking for duplicates…");
  let existing = await rest(s, "bookmarks?" + q);
  let id = existing[0]?.id;
  let reused = !!id;
  if (!id) {
    let title = tabTitle || d.url,
      description = "";
    progress("Fetching video details…");
    try {
      const meta = await fn(
        s,
        d.platform === "YouTube"
          ? "fetch-video-title"
          : "fetch-instagram-metadata",
        { url: d.url },
      );
      title = meta.title || title;
      description = meta.description || "";
    } catch (e) {
      console.warn("ReelMind: metadata unavailable", e.message);
    }
    let ai;
    progress("Classifying with AI…");
    try {
      ai = await fn(s, "classify-video", { title, description });
      if (!ai.category) throw Error("Invalid classification");
    } catch (e) {
      console.warn("ReelMind: AI classification unavailable", e.message);
      ai = {
        category: "Miscellaneous",
        subcategory: "Unclear Context",
        tags: [],
        confidence: 0,
        needsReview: true,
      };
    }
    progress("Saving bookmark…");
    const rows = await rest(s, "bookmarks", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: s.user.id,
        url: d.url,
        platform: d.platform.toLowerCase(),
        title,
        notes,
        category: ai.category,
        subcategory: ai.subcategory || null,
        tags: Array.isArray(ai.tags) ? ai.tags : [],
        ai_confidence: typeof ai.confidence === "number" ? ai.confidence : null,
        needs_review: ai.needsReview ?? true,
        folder_id: folder || null,
      }),
    });
    id = rows[0].id;
  }
  if (folder) {
    progress("Adding to folder…");
    try {
      await rest(s, "bookmark_folders?on_conflict=bookmark_id,folder_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          user_id: s.user.id,
          bookmark_id: id,
          folder_id: folder,
        }),
      });
    } catch (e) {
      throw Error(
        "Bookmark exists, but folder assignment failed. Retry: " + e.message,
      );
    }
  }
  return reused
    ? "Already in library. " +
        (folder
          ? "Folder added; existing notes preserved."
          : "Existing notes preserved.")
    : "Saved to ReelMind!";
}
