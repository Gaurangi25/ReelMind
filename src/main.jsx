import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  Search,
  Plus,
  Folder,
  CalendarDays,
  LogOut,
  Link2,
  Trash2,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  Check,
  BookOpen,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Clock3,
  Instagram,
  Youtube,
} from "lucide-react";
import { supabase, configured } from "./supabase";
import { testFolderPrivacy } from "./securityTest";
import { classifyVideo, fetchVideoTitle, fetchInstagramMetadata } from "./ai";
import { taxonomyV3 } from "./taxonomy";
if (import.meta.env.DEV) {
  window.testFolderPrivacy = testFolderPrivacy;
}
import "./style.css";
import { AppearanceProvider, useAppearance } from "./appearance/AppearanceContext";
import AppearanceSettings from "./appearance/AppearanceSettings";
import "./appearance/appearance.css";
const demo = [
  {
    id: "d1",
    title: "A practical introduction to AI agents",
    url: "https://www.youtube.com/watch?v=example1",
    platform: "youtube",
    category: "AI & Technology",
    saved_at: "2026-11-13T12:00:00Z",
    folder_id: "f1",
    notes: "Research ideas",
  },
  {
    id: "d2",
    title: "Five wardrobe essentials to know",
    url: "https://www.instagram.com/reel/example2/",
    platform: "instagram",
    category: "Fashion",
    saved_at: "2026-11-12T12:00:00Z",
    folder_id: "f3",
    notes: "",
  },
  {
    id: "d3",
    title: "Understanding database normalization",
    url: "https://www.youtube.com/watch?v=example3",
    platform: "youtube",
    category: "Academics",
    saved_at: "2026-11-10T12:00:00Z",
    folder_id: "f2",
    notes: "Revise before exam",
  },
  {
    id: "d4",
    title: "Free certifications worth exploring",
    url: "https://www.instagram.com/reel/example4/",
    platform: "instagram",
    category: "Certifications",
    saved_at: "2026-11-09T12:00:00Z",
    folder_id: null,
    notes: "",
  },
];
const demoFolders = [
  { id: "f1", name: "AI & Technology", parent_id: null },
  { id: "f2", name: "Academics", parent_id: null },
  { id: "f3", name: "Fashion & Style", parent_id: null },
];

// Shared Smart Categorization 3.0 taxonomy.
const taxonomy = taxonomyV3;
const legacyCategories = ["AI & Technology", "Academics", "Fashion", "Certifications", "Knowledge", "Career", "Food & Travel", "Fitness", "Unsorted"];
const categories = [...Object.keys(taxonomy), ...legacyCategories];
const defaultCategory = "Miscellaneous";
const defaultSubcategory = "Unclear Context";
const subcategoriesFor = (name) => taxonomy[name] || [];

function identify(url) {
  try {
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (["instagram.com", "www.instagram.com", "m.instagram.com"].includes(host))
      return "instagram";
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        host,
      )
    )
      return "youtube";
    return "other";
  } catch {
    return null;
  }
}

function suggest(title) {
  const t = title.toLowerCase();
  if (/certificat|credential/.test(t)) return "Technology & Career";
  if (/outfit|fashion|wardrobe|skincare|style/.test(t)) return "Lifestyle & Personal";
  if (/exam|dbms|lecture|study|semester|math/.test(t)) return "Learning & Knowledge";
  if (/ai |artificial intelligence|machine learning|llm|chatgpt|agent|coding|programming/.test(t))
    return "Technology & Career";
  if (/interview|resume|career|job/.test(t)) return "Technology & Career";
  if (/recipe|travel|restaurant|trip/.test(t)) return "Food, Travel & Experiences";
  if (/comedy|funny|meme|movie|song|music|lyrics/.test(t)) return "Entertainment & Pop Culture";
  if (/manifest|motivat|psychology|mindset|affirmation/.test(t)) return "Mindset & Spirituality";
  if (/gym|workout|fitness|yoga/.test(t)) return "Health & Fitness";
  return defaultCategory;
}

function suggestedSubcategory(title, mainCategory) {
  const t = title.toLowerCase();
  const guesses = [
    [/comedy|funny|meme/, "Comedy & Memes"],
    [/movie|film|cinema/, "Movies & Cinema"],
    [/song|music|lyrics/, "Music & Songs"],
    [/manifest|affirmation|law of attraction/, "Manifestation & Affirmations"],
    [/motivat|inspirational/, "Motivation"],
    [/psychology|human behavior/, "Psychology & Human Behavior"],
    [/python|coding|programming|javascript|react|backend/, "Programming & Development"],
    [/machine learning|artificial intelligence|chatgpt|llm/, "AI & Machine Learning"],
    [/outfit|fashion|wardrobe/, "Fashion & Styling"],
    [/gym|workout/, "Gym & Workouts"],
    [/recipe|cooking/, "Recipes & Cooking"],
  ];
  return guesses.find(([pattern, sub]) => pattern.test(t) && subcategoriesFor(mainCategory).includes(sub))?.[1]
    || (mainCategory === defaultCategory ? defaultSubcategory : "");
}

// Derive public YouTube thumbnails without storing or exposing credentials.
function youtubeThumbnail(link) {
  try {
    const u = new URL(link);
    const host = u.hostname.toLowerCase();
    let id = null;
    if (["youtu.be", "www.youtu.be"].includes(host)) id = u.pathname.split("/")[1];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      id = u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch { return null; }
}

function App() {
  const {prefs, update, ready} = useAppearance();
  const sidebarCollapsed = prefs.sidebarCollapsed;
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(configured),
    [authMode, setAuthMode] = useState("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [authMessage, setAuthMessage] = useState("");
  const [items, setItems] = useState(configured ? [] : demo),
    [folders, setFolders] = useState(configured ? [] : demoFolders),
    [active, setActive] = useState("all"),
    [search, setSearch] = useState(""),
    [browseSubcategory, setBrowseSubcategory] = useState(""),
    [browseTag, setBrowseTag] = useState(""),
    [reviewOnly, setReviewOnly] = useState(false),
    [modal, setModal] = useState(false),
    [folderModal, setFolderModal] = useState(false),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [category, setCategory] = useState(defaultCategory),
    [subcategory, setSubcategory] = useState(defaultSubcategory),
    [folder, setFolder] = useState([]),
    [notes, setNotes] = useState(""),
    [folderName, setFolderName] = useState(""),
    [parent, setParent] = useState("");
  const [memberships, setMemberships] = useState([]);
  const [picker, setPicker] = useState(null);
  const [selected, setSelected] = useState([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerError, setPickerError] = useState("");
  const [membershipReady, setMembershipReady] = useState(!configured);
  const [inlineFolder, setInlineFolder] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlineParent, setInlineParent] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const aiRequest = useRef(0);
  const manualTopic = useRef(false);
  const instagramCaption = useRef("");
  const instagramCache = useRef(new Map());
  const [titleLoading, setTitleLoading] = useState(false);
  const titleRequest = useRef(0);
  const sharedLinkHandled = useRef(false);

  // Receive Android Web Share Target links after authentication.
  useEffect(() => {
    if (loading || (configured && !session) || sharedLinkHandled.current) return;
    if (window.location.pathname !== "/share") return;

    const params = new URLSearchParams(window.location.search);
    const sharedText = [params.get("url"), params.get("text")].filter(Boolean).join(" ");
    const candidates = sharedText.match(/https?:\/\/[^\s<>"']+/gi) || [];
    const sharedUrl = candidates.map((value) => value.replace(/[),.;!?]+$/, ""))
      .find((value) => {
        try {
          const parsed = new URL(value);
          const host = parsed.hostname.toLowerCase();
          return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "instagram.com", "www.instagram.com", "m.instagram.com"].includes(host);
        } catch { return false; }
      });

    sharedLinkHandled.current = true;
    window.history.replaceState(null, "", "/");

    if (!sharedUrl) {
      setMessage("No supported Instagram or YouTube link was found in the share.");
      return;
    }

    const sharedTitle = (params.get("title") || "").trim().slice(0, 200);
    const urlHost = new URL(sharedUrl).hostname.toLowerCase();
    const isInstagram = ["instagram.com", "www.instagram.com", "m.instagram.com"].includes(urlHost);
    manualTopic.current = false;
    instagramCaption.current = "";
    setUrl(sharedUrl);
    setTitle(isInstagram ? sharedTitle : "");
    const sharedCategory = isInstagram && sharedTitle ? suggest(sharedTitle) : defaultCategory;
    setCategory(sharedCategory);
    setSubcategory(suggestedSubcategory(sharedTitle, sharedCategory));
    setAiSuggestion(null);
    setFolder([]);
    setNotes("");
    setModal(true);
  }, [loading, session?.user?.id]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session) {
      if (configured) {
        setItems([]);
        setFolders([]);
        setMemberships([]);
        setMembershipReady(false);
        setPicker(null);
      }
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from("bookmarks")
        .select("*")
        .order("saved_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at"),
      supabase.from("bookmark_folders").select("bookmark_id,folder_id"),
    ]).then(([a, b, c]) => {
      if (cancelled) return;
      if (a.error || b.error) setMessage(a.error?.message || b.error?.message);
      else {
        setItems(a.data);
        setFolders(b.data);
        if (c.error) { setMessage(c.error.message); setMembershipReady(false); }
        else { setMemberships(c.data); setMembershipReady(true); }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);
  const folderIds = (item) => supabase ? memberships.filter(m => m.bookmark_id === item.id).map(m => m.folder_id) : [...new Set([...(item.folder_id ? [item.folder_id] : []), ...memberships.filter(m => m.bookmark_id === item.id).map(m => m.folder_id)])];
  const activeFolder = folders.find(f => active === "folder:" + f.id);
  function openSave() { resetForm(); setFolder(activeFolder ? [activeFolder.id] : []); setModal(true); }
  // Filters combine with the existing folder/topic navigation and search.
  const availableSubcategories = useMemo(() =>
    [...new Set(items
      .filter((x) => active.startsWith("category:") ? x.category === active.slice(9) : true)
      .map((x) => x.subcategory)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items, active],
  );
  const availableTags = useMemo(() =>
    [...new Set(items.flatMap((x) => Array.isArray(x.tags) ? x.tags : [])
      .filter((tag) => typeof tag === "string" && tag.trim()))]
      .sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const shown = useMemo(
    () => items
      .filter((x) =>
        (active === "all" ||
          active === "recent" ||
          (active === "unsorted" && x.category === "Unsorted") ||
          (active.startsWith("folder:") && folderIds(x).includes(active.slice(7))) ||
          (active.startsWith("category:") && x.category === active.slice(9))) &&
        (!browseSubcategory || x.subcategory === browseSubcategory) &&
        (!browseTag || (Array.isArray(x.tags) && x.tags.includes(browseTag))) &&
        (!reviewOnly || x.needs_review === true) &&
        [x.title, x.url, x.notes, x.category, x.subcategory || "", ...(Array.isArray(x.tags) ? x.tags : [])]
          .join(" ").toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at)),
    [items, memberships, active, search, browseSubcategory, browseTag, reviewOnly],
  );
  const clearBrowseFilters = () => {
    setBrowseSubcategory("");
    setBrowseTag("");
    setReviewOnly(false);
  };
  async function authenticate(e) {
    e.preventDefault();
    setAuthMessage("");
    setBusy(true);
    const result =
      authMode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    setAuthMessage(
      result.error?.message ||
        (authMode === "signup"
          ? "Check your email to confirm your account."
          : ""),
    );
  }

    useEffect(() => {
    setAiLoading(false);
    setTitleLoading(false);
    if (!modal || !session || !supabase) return;

    const requestId = ++titleRequest.current;
    const input = url.trim();

    let parsed;
    try {
        parsed = new URL(input);
    } catch {
        setTitleLoading(false);
        return;
    }

    const host = parsed.hostname.toLowerCase();
    const isYouTube = [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
    ].includes(host);

    const isInstagram = parsed.protocol === "https:" &&
      ["instagram.com", "www.instagram.com", "m.instagram.com"].includes(host) &&
      !parsed.username && !parsed.password && !parsed.port &&
      /^\/(?:reels?|p)\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname);
    if (!isYouTube && !isInstagram) {
        setTitleLoading(false);
        return;
    }

    setTitleLoading(true);
    const timer = setTimeout(async () => {

        try {
        let fetchedTitle, description = "";
        if (isInstagram) {
          const path = parsed.pathname.replace(/^\/reels\//, "/reel/").replace(/\/$/, "") + "/";
          const canonical = "https://www.instagram.com" + path;
          const key = session.user.id + ":" + canonical;
          let pending = instagramCache.current.get(key);
          if (!pending) {
            pending = fetchInstagramMetadata(canonical).catch((error) => {
              instagramCache.current.delete(key);
              throw error;
            });
            instagramCache.current.set(key, pending);
          }
          const metadata = await pending;
          fetchedTitle = metadata.title;
          description = metadata.description;
        } else {
          fetchedTitle = await fetchVideoTitle(input);
        }

        if (requestId !== titleRequest.current) return;

        if (typeof fetchedTitle !== "string" || !fetchedTitle.trim()) {
          throw new Error("No video title was returned.");
        }
        instagramCaption.current = description;
        setTitle(fetchedTitle);
        if (!manualTopic.current) {
          const inferredCategory = suggest(fetchedTitle);
          setCategory(inferredCategory);
          setSubcategory(suggestedSubcategory(fetchedTitle, inferredCategory));
          // Pass the fetched value directly; React state may not be updated yet.
          void suggestWithAI(fetchedTitle, description);
        }
        } catch (error) {
        console.error("Video metadata fetch failed:", error);

        if (requestId === titleRequest.current) {
          setMessage(
            isInstagram ? "Could not fetch Instagram caption. Enter a title manually and use Suggest with AI." : "Could not fetch YouTube title: " +
            (error?.message || "Unknown error")
          );
        }
      } finally {
        if (requestId === titleRequest.current) {
            setTitleLoading(false);
        }
        }
    }, 650);

    return () => {
        clearTimeout(timer);
        titleRequest.current += 1;
        aiRequest.current += 1;
    };
    }, [url, modal, session?.user?.id]);

  useEffect(() => { if (modal) setMessage(""); }, [modal]);

  async function suggestWithAI(videoTitle, description = "") {
    if (!videoTitle.trim()) return;
    if (!supabase || !session) {
      setMessage("Sign in to use AI suggestions.");
      return;
    }
    const requestId = ++aiRequest.current;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      // Only title and available caption are shared, not private notes.
      const result = await classifyVideo(videoTitle.trim(), description);
      if (requestId !== aiRequest.current) return;
      if (!result || typeof result.category !== "string") {
        throw new Error("No valid AI suggestion was returned.");
      }
      const validAI = Object.prototype.hasOwnProperty.call(taxonomy, result.category) &&
        subcategoriesFor(result.category).includes(result.subcategory);
      const suggestedCategory = validAI ? result.category : defaultCategory;
      const suggestedSub = validAI ? result.subcategory : defaultSubcategory;
      setCategory(suggestedCategory);
      setSubcategory(suggestedSub);
      setAiSuggestion({
        category: suggestedCategory,
        subcategory: suggestedSub,
        confidence: typeof result.confidence === "number" ? result.confidence : null,
        needsReview: Boolean(result.needsReview) || !validAI,
        subject: typeof result.subject === "string" ? result.subject : "",
        tags: Array.isArray(result.tags)
          ? result.tags.filter((tag) => typeof tag === "string").slice(0, 5)
          : [],
      });
    } catch (error) {
      if (requestId === aiRequest.current) {
        setMessage(error.message || "AI suggestions are unavailable. You can still save manually.");
      }
    } finally {
      if (requestId === aiRequest.current) setAiLoading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    if (busy || titleLoading || aiLoading || folderSaving || inlineFolder) return;
    setSaveError("");
    if (!membershipReady && folder.length) { setSaveError("Folder data is unavailable. Refresh and try again before saving to a folder."); return; }
    const platform = identify(url.trim());
    if (!platform) {
      setSaveError("Enter a valid http(s) URL.");
      return;
    }
    if (url.length > 2048) {
      setSaveError("URL is too long.");
      return;
    }
    if (platform === "instagram" && !title.trim()) {
      setSaveError("Add a short title for this Instagram post before saving.");
      return;
    }
    setBusy(true);
    const payload = {
      url: url.trim(),
      title: title.trim() || "Untitled saved link",
      platform,
      category,
      subcategory: subcategoriesFor(category).includes(subcategory) ? subcategory : null,
      tags: aiSuggestion?.tags || [],
      ai_confidence: aiSuggestion?.category === category && aiSuggestion?.subcategory === subcategory
        ? (aiSuggestion.confidence ?? null) : null,
      needs_review: aiSuggestion?.category === category && aiSuggestion?.subcategory === subcategory
        ? (aiSuggestion.needsReview ?? false) : false,
      folder_id: null,
      notes: notes.trim(),
    };
    if (supabase) {
      try {
        const user_id = session.user.id;
        const lookup = () => supabase.from("bookmarks").select("*").eq("user_id", user_id).eq("url", payload.url).maybeSingle();
        let { data, error } = await lookup();
        if (error) throw error;
        let reused = Boolean(data);
        if (!data) {
          const inserted = await supabase.from("bookmarks").insert({ ...payload, user_id }).select().single();
          if (inserted.error?.code === "23505") {
            const existing = await lookup();
            if (existing.error) throw existing.error;
            if (!existing.data) throw inserted.error;
            data = existing.data;
            reused = true;
          } else {
            if (inserted.error) throw inserted.error;
            data = inserted.data;
          }
        }
        setItems(old => old.some(x => x.id === data.id) ? old : [data, ...old]);
        if (folder.length) {
          const rows = [...new Set(folder)].map(folder_id => ({bookmark_id: data.id, folder_id, user_id}));
          const result = await supabase.from("bookmark_folders").upsert(rows, {onConflict:"bookmark_id,folder_id", ignoreDuplicates:true});
          if (result.error) throw new Error("Bookmark is in your library, but folder assignment failed. Retry Save: " + result.error.message);
          setMemberships(old => [...old, ...rows.filter(m => !old.some(x => x.bookmark_id === m.bookmark_id && x.folder_id === m.folder_id))]);
        }
        setModal(false);
        resetForm();
        setSearch("");
        clearBrowseFilters();
        setMessage(folder.length ? (reused ? "Existing link added to " : "Link saved to ") + folders.filter(f => folder.includes(f.id)).map(f => f.name).join(", ") + "." : reused ? "This link is already in your library." : "Link saved privately.");
      } catch (error) {
        setSaveError(error?.message || "Could not save link. Please retry.");
      } finally {
        setBusy(false);
      }

    } else {
      const newId = crypto.randomUUID();
      setMemberships(old => [...old, ...folder.map(folder_id => ({bookmark_id:newId, folder_id}))]);
      setItems((old) => [
        {
          ...payload,
          id: newId,
          saved_at: new Date().toISOString(),
        },
        ...old,
      ]);
      setModal(false);
      resetForm();
      setSearch("");
      clearBrowseFilters();
      setMessage("Saved in preview mode (not persisted).");
    }
    setBusy(false);
  }
  function closeSaveModal() {
    if (folderSaving || busy) return;
    clearInlineFolder();
    setSaveError("");
    titleRequest.current += 1;
    aiRequest.current += 1;
    setTitleLoading(false);
    setAiLoading(false);
    setModal(false);
  }
  function resetForm() {
    clearInlineFolder();
    setSaveError("");
    manualTopic.current = false;
    titleRequest.current += 1;
    setTitleLoading(false);
    aiRequest.current += 1;
    setAiLoading(false);
    setAiSuggestion(null);
    instagramCaption.current = "";
    setUrl("");
    setTitle("");
    setCategory(defaultCategory);
    setSubcategory(defaultSubcategory);
    setFolder([]);
    setNotes("");
  }
  function clearInlineFolder() {
    setInlineFolder(false);
    setInlineName("");
    setInlineParent("");
    setFolderError("");
  }
  async function createInlineFolder() {
    const name = inlineName.trim();
    if (!name || folderSaving || busy) return;
    setFolderError("");
    if (folders.some(f => f.name.trim().toLowerCase() === name.toLowerCase() && (f.parent_id || "") === inlineParent)) {
      setFolderError("A folder with this name already exists here.");
      return;
    }
    setFolderSaving(true);
    try {
      const payload = { name, parent_id: inlineParent || null };
      let created;
      if (supabase) {
        if (!session) throw new Error("Please sign in again.");
        const { data, error } = await supabase.from("folders")
          .insert({ ...payload, user_id: session.user.id }).select().single();
        if (error) throw error;
        created = data;
      } else {
        created = { ...payload, id: crypto.randomUUID() };
      }
      setFolders(old => [...old, created]);
      setFolder(old => [...new Set([...old, created.id])]);
      clearInlineFolder();
    } catch (error) {
      setFolderError(error?.message || "Could not create folder. Try again.");
    } finally {
      setFolderSaving(false);
    }
  }
  async function addFolder(e) {
    e.preventDefault();
    if (!folderName.trim()) return;
    setBusy(true);
    const payload = { name: folderName.trim(), parent_id: parent || null };
    if (supabase) {
      const { data, error } = await supabase
        .from("folders")
        .insert({ ...payload, user_id: session.user.id })
        .select()
        .single();
      if (error) setMessage(error.message);
      else {
        setFolders((old) => [...old, data]);
        setFolderModal(false);
      }
    } else {
      setFolders((old) => [...old, { ...payload, id: crypto.randomUUID() }]);
      setFolderModal(false);
    }
    setFolderName("");
    setParent("");
    setBusy(false);
  }
  async function removeFromFolder(item, folderId) {
    if (busy || !membershipReady) return;
    if (!confirm("Remove this video from this folder only? It will remain in your library.")) return;
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("bookmark_folders")
          .delete().eq("bookmark_id", item.id).eq("folder_id", folderId);
        if (error) throw error;
      } else {
        setItems(old => old.map(x => x.id === item.id && x.folder_id === folderId ? {...x, folder_id: null} : x));
      }
      setMemberships(old => old.filter(m => m.bookmark_id !== item.id || m.folder_id !== folderId));
      setMessage("Removed from folder. Video remains in your library.");
    } catch (error) { setMessage(error.message || "Could not remove from folder."); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (busy) return;
    if (activeFolder) return removeFromFolder(item, activeFolder.id);
    if (!confirm("Permanently delete this saved link from your entire library and all folders?")) return;
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("bookmarks").delete().eq("id", item.id);
        if (error) throw error;
      }
      setItems(old => old.filter(x => x.id !== item.id));
      setMemberships(old => old.filter(m => m.bookmark_id !== item.id));
    } catch (error) { setMessage(error.message || "Could not delete saved link."); }
    finally { setBusy(false); }
  }
  function openPicker(kind, id) {
    if (!membershipReady) return;
    setPicker({kind,id}); setSelected(kind === "video" ? folderIds(items.find(x => x.id === id)) : []); setPickerSearch(""); setPickerError("");
  }
  async function applyPicker(e) {
    e.preventDefault(); if (busy || !picker || !membershipReady) return;
    setBusy(true); setPickerError("");
    try {
      const additions = picker.kind === "video" ? selected.filter(id => !folderIds(items.find(x => x.id === picker.id)).includes(id)).map(folder_id => ({bookmark_id:picker.id,folder_id})) : selected.map(bookmark_id => ({bookmark_id,folder_id:picker.id}));
      const removed = picker.kind === "video" ? folderIds(items.find(x => x.id === picker.id)).filter(id => !selected.includes(id)) : [];
      if (additions.length) {
        if (supabase) { const {error} = await supabase.from("bookmark_folders").upsert(additions.map(m => ({...m,user_id:session.user.id})), {onConflict:"bookmark_id,folder_id",ignoreDuplicates:true}); if(error) throw error; }
        setMemberships(old => [...old, ...additions.filter(m => !old.some(x => x.bookmark_id === m.bookmark_id && x.folder_id === m.folder_id))]);
      }
      if (removed.length) {
        if (supabase) { const {error} = await supabase.from("bookmark_folders").delete().eq("bookmark_id",picker.id).in("folder_id",removed); if(error) throw error; }
        else setItems(old => old.map(x => x.id === picker.id && removed.includes(x.folder_id) ? {...x,folder_id:null} : x));
        setMemberships(old => old.filter(m => m.bookmark_id !== picker.id || !removed.includes(m.folder_id)));
      }
      setPicker(null); setMessage("Folders updated.");
    } catch(error) { setPickerError(error.message || "Could not update folders."); } finally { setBusy(false); }
  }
  async function renameFolder() {
    if (!activeFolder || busy) return;
    const name = prompt("Rename folder", activeFolder.name)?.trim(); if (!name || name === activeFolder.name || name.length > 80) return;
    setBusy(true); try { if (supabase) {const {error}=await supabase.from("folders").update({name}).eq("id",activeFolder.id); if(error) throw error;} setFolders(old=>old.map(f=>f.id===activeFolder.id?{...f,name}:f)); } catch(error){setMessage(error.message);} finally{setBusy(false);}
  }
  async function deleteFolder() {
    if (!activeFolder || busy) return;
    if (folders.some(f=>f.parent_id===activeFolder.id)) {setMessage("Remove or reorganize subfolders before deleting this folder."); return;}
    if (!confirm("Delete this folder? Your saved videos will remain in All saved.")) return;
    setBusy(true); try { if(supabase){const {error}=await supabase.from("folders").delete().eq("id",activeFolder.id);if(error)throw error;} setFolders(old=>old.filter(f=>f.id!==activeFolder.id));setMemberships(old=>old.filter(m=>m.folder_id!==activeFolder.id));setItems(old=>old.map(x=>x.folder_id===activeFolder.id?{...x,folder_id:null}:x));setActive("all");setSearch("");clearBrowseFilters(); }catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  const label =
    active === "all"
      ? "All saved"
      : active === "recent"
        ? "Recently saved"
        : active === "unsorted"
          ? "Unsorted"
          : active.startsWith("folder:")
            ? folders.find((f) => f.id === active.slice(7))?.name || "Folder"
            : active.slice(9);
  // Render folders in parent-first order, guarding against invalid parent links.
  const folderTree = [];
  const visitedFolders = new Set();
  function visitFolder(f, depth = 0) {
    if (visitedFolders.has(f.id)) return;
    visitedFolders.add(f.id);
    folderTree.push({ ...f, depth });
    folders.filter(child => child.parent_id === f.id).forEach(child => visitFolder(child, depth + 1));
  }
  folders.filter(f => !f.parent_id || !folders.some(p => p.id === f.parent_id)).forEach(f => visitFolder(f));
  folders.forEach(f => visitFolder(f));
  const ancestors = [];
  const seenAncestors = new Set(activeFolder ? [activeFolder.id] : []);
  let ancestor = activeFolder && folders.find(f => f.id === activeFolder.parent_id);
  while (ancestor && !seenAncestors.has(ancestor.id)) {
    seenAncestors.add(ancestor.id);
    ancestors.unshift(ancestor);
    ancestor = folders.find(f => f.id === ancestor.parent_id);
  }
  const navigateFolder = (id) => { setActive("folder:" + id); setSearch(""); clearBrowseFilters(); setMenu(false); };
  const nav = (name, id, Icon, count, depth = 0) => (
    <button
      key={id}
      style={depth ? {paddingLeft: 12 + Math.min(depth, 8) * 17} : undefined}
      className={"nav-item " + (active === id ? "selected" : "")}
      onClick={() => {
        setActive(id);
        setSearch("");
        clearBrowseFilters();
        setMenu(false);
      }}
    >
      <Icon size={17} />
      <span>{name}</span>
      {count !== undefined && <small>{count}</small>}
    </button>
  );
  if (loading) return <div className="center-screen">Loading ReelMind…</div>;
  if (configured && !session)
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <span className="brand-mark">
            <Bookmark size={22} strokeWidth={2.4} />
          </span>{" "}
          reelmind<span className="brand-dot">.</span>
        </div>
        <div className="auth-card">
          <span className="eyebrow">YOUR PERSONAL LIBRARY</span>
          <h1>
            {authMode === "signin"
              ? "Welcome back."
              : "Make space for what matters."}
          </h1>
          <p>
            All your saved videos, thoughtfully organized and private to you.
          </p>
          <form onSubmit={authenticate}>
            <label>
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : authMode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          {authMessage && <p className="notice">{authMessage}</p>}
          <p className="auth-switch">
            {authMode === "signin"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthMessage("");
              }}
            >
              {authMode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={15} /> Your library is private by default.
        </div>
      </div>
    );
  return (
    <div className={"shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <div className="sidebar-top">
          <div className="logo">
            <span className="brand-mark">
              <Bookmark size={20} strokeWidth={2.5} />
            </span>{" "}
            reelmind<span className="brand-dot">.</span>
          </div>
          <button type="button" className="icon-btn desktop-sidebar-toggle sidebar-collapse" disabled={!ready} aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded={true} onClick={()=>update({sidebarCollapsed:true})}><PanelLeftClose size={18}/></button>
          <button
            className="icon-btn close-mobile"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="new-btn"
          onClick={() => {
            openSave();
            setMenu(false);
          }}
        >
          <Plus size={18} /> Save a link <span>+</span>
        </button>
        <div className="nav-section">
          <span className="section-label">LIBRARY</span>
          {nav("All saved", "all", LayoutGrid, items.length)}
          {nav("Recently saved", "recent", Clock3)}
          {nav(
            "Unsorted",
            "unsorted",
            Bookmark,
            items.filter((x) => x.category === "Unsorted").length,
          )}
        </div>
        <div className="nav-section">
          <div className="section-row">
            <span className="section-label">YOUR FOLDERS</span>
            <button
              className="small-icon"
              title="Create folder"
              onClick={() => {setParent(activeFolder?.id || ""); setFolderModal(true);}}
            >
              <Plus size={16} />
            </button>
          </div>
          {folderTree.map((f) =>
            nav(
              f.name,
              "folder:" + f.id,
              Folder,
              items.filter((x) => folderIds(x).includes(f.id)).length,
              f.depth,
            ),
          )}
          {folders.length === 0 && (
            <p className="sidebar-hint">
              Create folders for your favorite topics.
            </p>
          )}
        </div>
        <div className="nav-section">
          <span className="section-label">TOPICS</span>
          {categories
            .filter((c) => items.some((x) => x.category === c))
            .map((c) => nav(c, "category:" + c, BookOpen))}
        </div>
        <div className="sidebar-bottom">
          <AppearanceSettings />
          <div className="privacy">
            <ShieldCheck size={16} />
            <span>Private by default</span>
          </div>
          {session ? (
            <button className="account" onClick={() => supabase.auth.signOut()}>
              <span className="avatar">
                {session.user.email?.[0]?.toUpperCase()}
              </span>
              <span className="account-email">{session.user.email}</span>
              <LogOut size={16} />
            </button>
          ) : (
            <div className="demo-flag">Preview mode · No account connected</div>
          )}
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main className="main">
        <header className="topbar">
          {sidebarCollapsed && <button type="button" className="icon-btn desktop-sidebar-toggle sidebar-reopen" disabled={!ready} aria-label="Expand sidebar" title="Expand sidebar" aria-expanded={false} onClick={()=>update({sidebarCollapsed:false})}><PanelLeftOpen size={20}/></button>}
          <button className="icon-btn hamburger" onClick={() => setMenu(true)}>
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Your library {ancestors.map(f => <React.Fragment key={f.id}><span>/</span><button type="button" onClick={() => navigateFolder(f.id)} style={{border:0,background:"none",padding:0,color:"inherit",font:"inherit",textDecoration:"underline"}}>{f.name}</button></React.Fragment>)} <span>/</span> <strong>{label}</strong>
          </div>
          <div className="top-actions">
            <span className="top-private">
              <ShieldCheck size={15} /> Personal workspace
            </span>
            <button
              className="primary header-add"
              onClick={openSave}
            >
              <Plus size={17} /> Save link
            </button>
          </div>
        </header>
        <div className="content">
          <section className="editorial-intro">
            <div className="eyebrow">YOUR PERSONAL VIDEO LIBRARY</div>
            <h1>Good things, worth keeping<span className="period">.</span></h1>
            <p>A home for the videos you love, learn from, and want to revisit.</p>
            <div className="library-overview"><span>{items.length} saved videos</span><span className="overview-dot">·</span><span>{new Set(items.map((x) => x.category)).size} topics</span></div>
          </section>
          <div className="library-head">
            <div>
              <span className="eyebrow">YOUR COLLECTION</span>
              <h2>{label}</h2>
            </div>
            <span className="count">
              {shown.length} {shown.length === 1 ? "item" : "items"}
            </span>
          </div>
          {activeFolder && <div className="folder-tools"><button className="primary" onClick={openSave}><Plus size={16}/> New link</button><button className="secondary" disabled={!membershipReady} onClick={()=>openPicker("folder",activeFolder.id)}><Bookmark size={16}/> Add from library</button><button className="secondary" disabled={busy} onClick={renameFolder}>Rename</button><button className="secondary" disabled={busy} onClick={deleteFolder}><Trash2 size={15}/> Delete folder</button></div>}
          <div className="toolbar">
            <div className="search">
              <Search size={19} />
              <input
                placeholder="Search saved links, notes, topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="layout-switch" role="group" aria-label="Library layout">{[["grid",LayoutGrid],["list",List]].map(([mode,Icon])=><button type="button" key={mode} disabled={!ready} aria-label={`${mode} view`} title={`${mode} view`} aria-pressed={prefs.layout===mode} onClick={()=>update({layout:mode})}><Icon size={18}/></button>)}</div>
            <button className="filter" title="Showing newest first">
              <SlidersHorizontal size={17} /> Newest first
            </button>
          </div>
          <details className="refine-panel" open={Boolean(browseSubcategory || browseTag || reviewOnly)}>
            <summary><SlidersHorizontal size={16} /> Refine your library <span>{browseSubcategory || browseTag || reviewOnly ? "· Active filters" : "· Optional"}</span></summary>
          <div className="browse-filters" >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 190px", minWidth: 0 }}>
              <span style={{ fontSize: 12 }}>Subcategory</span>
              <select aria-label="Filter by subcategory" value={browseSubcategory}
                onChange={(e) => setBrowseSubcategory(e.target.value)}
                style={{ width: "100%" }}>
                <option value="">All subcategories</option>
                {availableSubcategories.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 0 }}>
              <span style={{ fontSize: 12 }}>AI tag</span>
              <select aria-label="Filter by AI tag" value={browseTag}
                onChange={(e) => setBrowseTag(e.target.value)}
                style={{ width: "100%" }}>
                <option value="">All tags</option>
                {availableTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
              Needs review
            </label>
            {(browseSubcategory || browseTag || reviewOnly || search) && (
              <button type="button" className="secondary" style={{ marginTop: 16 }} onClick={() => { clearBrowseFilters(); setSearch(""); }}>
                Clear filters
              </button>
            )}
          </div>
          </details>
          {message && (
            <div className="toast" role="status">
              {message}
              <button onClick={() => setMessage("")}>
                <X size={15} />
              </button>
            </div>
          )}
          <div className={"cards visual-grid" + (prefs.layout === "list" ? " visual-list" : "")}>
            {shown.map((item) => {
              const thumbnail = item.platform === "youtube" ? youtubeThumbnail(item.url) : null;
              return (
                <article className="video-card visual-card" key={item.id}>
                  <a className={`video-cover ${item.platform}`} href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title}`}>
                    {thumbnail ? <img src={thumbnail} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.classList.add("no-image"); }} /> : null}
                    <span className="cover-placeholder">{item.platform === "instagram" ? <Instagram size={35} /> : item.platform === "youtube" ? <Youtube size={38} /> : <Link2 size={32} />}</span>
                    <span className="cover-platform">{item.platform === "youtube" ? "YouTube" : item.platform === "instagram" ? "Instagram" : "Saved link"}</span>
                    <span className="cover-open"><ArrowUpRight size={17} /></span>
                  </a>
                  <div className="video-body">
                    <div className="video-meta"><span>{new Date(item.saved_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span></div>
                    <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
                    <div className="tags">
                      <button type="button" className="tag" onClick={() => { setActive("category:" + item.category); clearBrowseFilters(); }}>{item.category}</button>
                      {item.subcategory && <button type="button" className="tag muted" onClick={() => { setActive("all"); setBrowseSubcategory(item.subcategory); setBrowseTag(""); }}>{item.subcategory}</button>}
                    </div>
                    {item.notes && <p className="video-note">{item.notes}</p>}
                    {Array.isArray(item.tags) && item.tags.length > 0 && <div className="tags mini-tags">{item.tags.slice(0, 3).map((tag) => <button type="button" key={tag} className="tag muted" onClick={() => { setActive("all"); setBrowseSubcategory(""); setBrowseTag(tag); }}>#{tag}</button>)}</div>}
                    {item.needs_review && <button type="button" className="review-link" onClick={() => { setActive("all"); clearBrowseFilters(); setReviewOnly(true); }}>Needs review</button>}
                    <div className="card-footer">
                      <span className="folder-hint" title={folders.filter(f=>folderIds(item).includes(f.id)).map(f=>f.name).join(", ")}>{folderIds(item).length ? <><Folder size={13}/>{folders.filter(f=>folderIds(item).includes(f.id)).map(f=>f.name).join(", ")}</> : "Saved to library"}</span>
                      <div className="card-actions"><button title="Manage folders" aria-label="Manage folders" disabled={!membershipReady} onClick={()=>openPicker("video",item.id)}><Folder size={17}/></button><a title="Open original" href={item.url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={18} /></a><button title={activeFolder ? "Remove from folder" : "Delete from library"} aria-label={activeFolder ? "Remove from folder" : "Delete from library"} disabled={busy || (!!activeFolder && !membershipReady)} onClick={() => remove(item)}>{activeFolder ? <X size={16} /> : <Trash2 size={16} />}</button></div>
                    </div>
                  </div>
                </article>
              );
            })}
            {shown.length === 0 && <div className="empty"><div className="empty-icon"><Bookmark size={29} /></div><h3>Nothing here yet</h3><p>Save a video or try another filter to find what you are looking for.</p><button className="primary" onClick={openSave}><Plus size={16} /> Save a link</button></div>}
          </div>
          <footer>
            ReelMind · A little less scrolling, a lot more finding.
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) { closeSaveModal(); }
          }}
        >
          <div
            className="modal save-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Save a link"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">ADD TO YOUR LIBRARY</span>
                <h2>Save a link</h2>
              </div>
              <button className="icon-btn" onClick={() => { closeSaveModal(); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              <label>
                Video or post URL
                <input
                  required
                  type="url"
                  placeholder="https://www.instagram.com/reel/..."
                  value={url}
                  onChange={(e) => {
                    titleRequest.current += 1;
                    setTitleLoading(false);
                    manualTopic.current = false;
                    instagramCaption.current = "";
                    setUrl(e.target.value);
                    setTitle("");
                    setCategory(defaultCategory);
                    setSubcategory(defaultSubcategory);
                    setAiSuggestion(null);
                    aiRequest.current += 1;
                    setAiLoading(false);
                    }}
                />
              </label>
              <label>
                Title
                <input
                  maxLength={200}
                  placeholder="What is this video about?"
                  value={title}
                  onChange={(e) => {
                    titleRequest.current += 1;
                    setTitleLoading(false);
                    aiRequest.current += 1;
                    setAiLoading(false);
                    setAiSuggestion(null);
                    instagramCaption.current = "";
                    setTitle(e.target.value);
                    if (!manualTopic.current) {
                      const inferredCategory = suggest(e.target.value);
                      setCategory(inferredCategory);
                      setSubcategory(suggestedSubcategory(e.target.value, inferredCategory));
                    }
                  }}
                />
              </label>
              {(titleLoading || aiLoading) && <div className="save-progress" role="status" aria-live="polite">
                {titleLoading || aiLoading ? (
                  <><span className="save-spinner" aria-hidden="true" /><div><strong>{titleLoading ? (identify(url.trim()) === "instagram" ? "Fetching Instagram caption…" : "Fetching YouTube title…") : "Finding the right topic…"}</strong><small>{titleLoading ? "Retrieving available video details." : "Analyzing the title and available caption."}</small></div></>
                ) : null}
              </div>}
              <details className="save-disclosure">
                <summary><ShieldCheck size={15}/> How AI works <ChevronDown size={15}/></summary>
              {identify(url.trim()) === "instagram" && (
                <p className="save-disclosure-text" role="status">
                  Instagram metadata is fetched automatically when available. If it cannot be retrieved, enter a descriptive title or caption and use Suggest with AI. ReelMind saves the link, not the video.
                </p>
              )}
              <p className="save-disclosure-text">
                YouTube titles and available Instagram captions are automatically sent to Google Gemini for classification. Instagram links are sent to OpenGraph.io to retrieve metadata. For other links, use Suggest with AI.
                ReelMind does not watch the video or send your personal notes.
                You can always choose a topic yourself.
              </p>
              </details>
              {message && <p className="save-feedback" role="status">{message}</p>}
              <button
                type="button"
                className="secondary save-ai-button"
                disabled={titleLoading || aiLoading || !title.trim() || !supabase}
                onClick={() => { manualTopic.current = false; void suggestWithAI(title, instagramCaption.current); }}
              >
                {aiLoading ? "Analyzing…" : "Suggest with AI"}
              </button>
              {aiSuggestion && (
                <div className="ai-suggestion refined-suggestion" role="status">
                  <div className="suggestion-heading">
                    <span><Check size={15} aria-hidden="true"/> AI suggestion</span>
                    {aiSuggestion.confidence !== null && <small>{Math.round(aiSuggestion.confidence * 100)}% confidence estimate</small>}
                  </div>
                  <strong className="suggestion-subject">{aiSuggestion.subject || "Subject not identified"}</strong>
                  <div className="suggestion-topic"><span>{aiSuggestion.category}</span>{aiSuggestion.subcategory && <span>{aiSuggestion.subcategory}</span>}</div>
                  <div className="suggestion-tags" aria-label="Suggested tags">{aiSuggestion.tags.length ? aiSuggestion.tags.map((tag, i) => <span key={i}>#{tag.replace(/^#/, "")}</span>) : <small>No tags suggested</small>}</div>
                  <small className="suggestion-hint">{aiSuggestion.needsReview ? "Please review this classification before saving." : "You can change the topic below before saving."}</small>
                </div>
              )}
              <div className="two-col">
                <label>
                  Topic
                  <select
                    value={category}
                    onChange={(e) => {
                      manualTopic.current = true;
                      const nextCategory = e.target.value;
                      setCategory(nextCategory);
                      setSubcategory(nextCategory === defaultCategory ? defaultSubcategory : "");
                      aiRequest.current += 1;
                      setAiLoading(false);
                    }}
                  >
                    <optgroup label="Smart categories">
                      {Object.keys(taxonomy).map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Legacy categories">
                      {legacyCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </label>
                <div className="save-folder-field"><span className="save-folder-label">Folders <button type="button" className="save-folder-add" disabled={folderSaving || busy || !membershipReady} onClick={() => {setInlineFolder(true);setFolderError("");}}><Plus size={14}/> New folder</button></span><details className="folder-select"><summary>{folder.length ? folders.filter(f => folder.includes(f.id)).map(f => f.name).join(", ") : "No folder"}<ChevronDown size={15}/></summary><div className="folder-options">{folderTree.map(f=><label key={f.id}><input type="checkbox" disabled={!membershipReady || busy} checked={folder.includes(f.id)} onChange={()=>setFolder(old=>old.includes(f.id)?old.filter(id=>id!==f.id):[...old,f.id])}/>{"— ".repeat(f.depth)}{f.name}</label>)}{!folders.length && <small>No folders yet</small>}</div></details></div>
              </div>
              {inlineFolder && (
                <section className="inline-folder" aria-label="Create a folder">
                  <strong>Create a new folder</strong>
                  <label>Folder name<input autoFocus maxLength={80} value={inlineName} disabled={folderSaving} placeholder="e.g. Favourite videos" onChange={e => setInlineName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void createInlineFolder(); } }}/></label>
                  <label>Inside folder (optional)<select value={inlineParent} disabled={folderSaving} onChange={e => setInlineParent(e.target.value)}><option value="">Top level</option>{folderTree.map(f => <option key={f.id} value={f.id}>{"— ".repeat(f.depth)}{f.name}</option>)}</select></label>
                  {folderError && <p className="save-feedback" role="alert">{folderError}</p>}
                  <div className="inline-folder-actions"><button type="button" className="secondary" disabled={folderSaving} onClick={clearInlineFolder}>Cancel</button><button type="button" className="primary" disabled={!inlineName.trim() || folderSaving || busy} onClick={createInlineFolder}><Plus size={15}/>{folderSaving ? "Creating…" : "Create folder"}</button></div>
                </section>
              )}
               {subcategoriesFor(category).length > 0 && (
                 <label>
                   Subcategory
                   <select value={subcategory} onChange={(e) => {
                     manualTopic.current = true;
                     setSubcategory(e.target.value);
                     aiRequest.current += 1;
                     setAiLoading(false);
                   }}>
                     <option value="">Choose a subcategory (optional)</option>
                     {subcategoriesFor(category).map((sub) => (
                       <option key={sub} value={sub}>{sub}</option>
                     ))}
                   </select>
                 </label>
               )}
               <label>
                 Personal note (optional)
                <textarea
                  maxLength={1000}
                  rows="3"
                  placeholder="Why did you save this?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {saveError && <p className="save-feedback" role="alert">{saveError}</p>}
              <div className="modal-buttons save-sticky-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => { closeSaveModal(); }}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy || titleLoading || aiLoading || folderSaving || inlineFolder}>
                  <Bookmark size={16} />
                  {busy ? "Saving…" : "Save link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {picker && <div className="modal-backdrop"><div className="modal compact" role="dialog" aria-modal="true" aria-label="Manage folders"><div className="modal-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>{picker.kind === "folder" ? "Add from library" : "Manage folders"}</h2></div><button className="icon-btn" disabled={busy} onClick={()=>setPicker(null)}><X size={20}/></button></div><form onSubmit={applyPicker}><label>Search<input value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder="Search…"/></label><div className="folder-picker-list">{(picker.kind === "folder" ? items.filter(x=>!folderIds(x).includes(picker.id)).map(x=>({id:x.id,name:x.title})) : folders).filter(x=>x.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(x=><label key={x.id}><input type="checkbox" disabled={busy} checked={selected.includes(x.id)} onChange={()=>setSelected(old=>old.includes(x.id)?old.filter(id=>id!==x.id):[...old,x.id])}/><span>{x.name}</span></label>)}</div><p className="folder-picker-hint">{picker.kind === "folder" ? "Videos stay in their original folders." : "Uncheck a folder to remove the video from that folder only."}</p>{pickerError && <p className="save-feedback" role="alert">{pickerError}</p>}<div className="modal-buttons"><button type="button" className="secondary" disabled={busy} onClick={()=>setPicker(null)}>Cancel</button><button className="primary" disabled={busy || (picker.kind === "folder" && !selected.length)}>{busy?"Saving…":"Save changes"}</button></div></form></div></div>}
      {folderModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFolderModal(false);
          }}
        >
          <div
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Create folder"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">STAY ORGANIZED</span>
                <h2>New folder</h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setFolderModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={addFolder}>
              <label>
                Folder name
                <input
                  required
                  maxLength={80}
                  autoFocus
                  placeholder="e.g. Computer Networks"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
              </label>
              <label>
                Inside folder (optional)
                <select
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">Top level</option>
                  {folderTree.map((f) => (
                      <option key={f.id} value={f.id}>
                        {"— ".repeat(f.depth)}{f.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="modal-buttons">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setFolderModal(false)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  <Plus size={16} /> Create folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")).render(<AppearanceProvider><App /></AppearanceProvider>);
