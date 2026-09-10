// Place this file at: app/page.tsx
// Pairs with: lib/supabaseClient.ts, app/api/image-proxy/route.ts, globals.css (from styles.css)
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

// ============================================================
// Types
// ============================================================
type PostStatus = 'draft' | 'approved' | 'scheduled' | 'posted';

interface Post {
  id: string;
  title: string | null;
  caption: string | null;
  image_url: string | null;
  status: PostStatus;
  platforms: string[] | null;
  scheduled_date: string;
  scheduled_time: string | null;
  created_at: string;
  updated_at: string;
}

interface DateCount {
  date: string;
  posted_count: number;
  scheduled_count: number;
}

type LangCode = 'en' | 'bn' | 'de';

// ============================================================
// n8n webhook endpoints (called directly from the browser)
// ============================================================
const N8N_GENERATE_CONTENT_MORNING_URL = process.env.NEXT_PUBLIC_N8N_GENERATE_CONTENT_MORNING_WEBHOOK || '';
const N8N_GENERATE_CONTENT_EVENING_URL = process.env.NEXT_PUBLIC_N8N_GENERATE_CONTENT_EVENING_WEBHOOK || '';
const N8N_IMPROVE_MORNING_URL = process.env.NEXT_PUBLIC_N8N_IMPROVE_MORNING_WEBHOOK || '';
const N8N_IMPROVE_EVENING_URL = process.env.NEXT_PUBLIC_N8N_IMPROVE_EVENING_WEBHOOK || '';
const N8N_APPROVE_MORNING_URL = process.env.NEXT_PUBLIC_N8N_APPROVE_MORNING_WEBHOOK || '';
const N8N_APPROVE_EVENING_URL = process.env.NEXT_PUBLIC_N8N_APPROVE_EVENING_WEBHOOK || '';
const N8N_POST_NOW_MORNING_URL = process.env.NEXT_PUBLIC_N8N_POST_NOW_MORNING_WEBHOOK || '';
const N8N_POST_NOW_EVENING_URL = process.env.NEXT_PUBLIC_N8N_POST_NOW_EVENING_WEBHOOK || '';
const N8N_TRANSLATE_URL = process.env.NEXT_PUBLIC_N8N_TRANSLATE_WEBHOOK || '';
const N8N_FEEDBACK_URL = process.env.NEXT_PUBLIC_N8N_FEEDBACK_WEBHOOK || '';

// ============================================================
// Translations
// ============================================================
const TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  en: {
    navTitle: 'Post Approval Dashboard',
    langLabel: 'Language',
    calendar: 'Calendar',
    selectedDate: 'Date',
    loading: 'Loading...',
    status: 'Status',
    scheduled: 'Scheduled',
    approve: 'Approve',
    edit: 'Edit',
    cancel: 'Cancel',
    noPosts: 'No posts on this date.',
    generate: 'Generate Content',
    triggering: 'Preparing...',
    approvedBanner: 'approved and scheduled.',
    generatedBanner: 'Generated',
    postsWord: 'post(s) for',
    showMore: 'Show More',
    socialMediaPostFor: 'Social Media post for',
    platform: 'Platform',
    approveWarning: 'Please, approve after selecting the platform',
    platformRequiredWarning: 'Please select any platform first',
    scheduledText: 'Scheduled',
    statusText: 'Status',
    noNotifications: 'No notifications',
    hasPostsHint: 'Has posts',
    noPostsHint: 'No posts',
    locale: 'en-US',
  },
  bn: {
    navTitle: 'পোস্ট অনুমোদন ড্যাশবোর্ড',
    langLabel: 'ভাষা',
    calendar: 'ক্যালেন্ডার',
    selectedDate: 'তারিখ',
    loading: 'লোড হচ্ছে...',
    status: 'স্ট্যাটাস',
    scheduled: 'নির্ধারিত',
    approve: 'অনুমোদন',
    edit: 'এডিট',
    cancel: 'বাতিল',
    noPosts: 'এই তারিখে কোনো পোস্ট নেই।',
    generate: 'কনটেন্ট তৈরি করুন',
    triggering: 'ট্রিগার হচ্ছে...',
    approvedBanner: 'অনুমোদিত এবং নির্ধারিত।',
    generatedBanner: 'তৈরি হয়েছে',
    postsWord: 'পোস্ট এই তারিখের জন্য',
    showMore: 'আরও দেখুন',
    socialMediaPostFor: 'সোশ্যাল মিডিয়া পোস্ট',
    platform: 'প্ল্যাটফর্ম',
    approveWarning: 'প্ল্যাটফর্ম সিলেক্ট করে তারপর অনুমোদন করুন',
    platformRequiredWarning: 'Please select any platform first',
    scheduledText: 'নির্ধারিত',
    statusText: 'স্ট্যাটাস',
    noNotifications: 'কোনো নোটিফিকেশন নেই',
    hasPostsHint: 'পোস্ট আছে',
    noPostsHint: 'পোস্ট নেই',
    locale: 'bn-BD',
  },
  de: {
    navTitle: 'Beitragsfreigabe-Dashboard',
    langLabel: 'Sprache',
    calendar: 'Kalender',
    selectedDate: 'Datum',
    loading: 'Wird geladen...',
    status: 'Status',
    scheduled: 'Geplant',
    approve: 'Freigeben',
    edit: 'Bearbeiten',
    cancel: 'Abbrechen',
    noPosts: 'Keine Beiträge für dieses Datum.',
    generate: 'Inhalt generieren',
    triggering: 'Wird ausgelöst...',
    approvedBanner: 'freigegeben und geplant.',
    generatedBanner: 'Generiert',
    postsWord: 'Beitrag/Beiträge für',
    showMore: 'Mehr anzeigen',
    socialMediaPostFor: 'Social-Media-Beitrag für',
    platform: 'Plattform',
    approveWarning: 'Bitte erst Plattform auswählen, dann freigeben',
    platformRequiredWarning: 'Please select any platform first',
    scheduledText: 'Geplant',
    statusText: 'Status',
    noNotifications: 'Keine Benachrichtigungen',
    hasPostsHint: 'Hat Beiträge',
    noPostsHint: 'Keine Beiträge',
    locale: 'de-DE',
  },
};

// ============================================================
// Helpers
// ============================================================
function proxiedImageUrl(url: string | null): string {
  return `/api/image-proxy?url=${encodeURIComponent(url || '')}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return dateStr;
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthGrid(viewDate: Date): Date[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday start
  const start = new Date(year, month, 1 - startDay);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function monthLabel(d: Date, locale: string): string {
  return d.toLocaleDateString(locale || 'en-US', { month: 'long', year: 'numeric' });
}

function deriveTitle(post: Post): string {
  const raw = (post.title || '').trim();
  if (raw) return raw;
  const cap = (post.caption || '').trim();
  if (!cap) return 'Untitled';
  const firstLine = cap.split(/\n+/)[0].trim();
  return (firstLine || cap).slice(0, 90);
}

function firstFourWords(text: string): string {
  return String(text || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

function parseCaptionByLanguage(rawCaption: string | null): Record<string, string> | null {
  if (!rawCaption) return null;

  try {
    const parsed = JSON.parse(rawCaption);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // not JSON, fall through
  }

  const text = String(rawCaption || '');
  const rx = /(English|EN|Bengali|Bangla|BN|BD|German|Deutsch|DE)\s*:\s*([\s\S]*?)(?=\n\s*(?:English|EN|Bengali|Bangla|BN|BD|German|Deutsch|DE)\s*:|$)/gi;
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    const k = (m[1] || '').trim();
    const v = (m[2] || '').trim();
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function captionForLanguage(rawCaption: string | null, selectedLanguage: string): string {
  const byLang = parseCaptionByLanguage(rawCaption);
  if (!byLang) return rawCaption || '';

  const requested = String(selectedLanguage || 'English').toLowerCase();
  const aliases: Record<string, string[]> = {
    english: ['english', 'en', 'eng'],
    bengali: ['bengali', 'bangla', 'bn', 'bd'],
    german: ['german', 'deutsch', 'de', 'ger'],
  };

  const wanted = aliases[requested] || [requested];
  const keys = Object.keys(byLang);

  let key = keys.find((k) => wanted.includes(k.toLowerCase()));
  if (!key) {
    key = keys.find((k) => wanted.some((w) => k.toLowerCase().includes(w)));
  }

  if (key && byLang[key]) return byLang[key];

  const fallback = byLang.English || byLang.english || byLang.EN || byLang.en || Object.values(byLang)[0];
  return fallback || rawCaption || '';
}

function formatCardTime(value: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '7:00 PM';

  const normalizedInput = raw.replace('.', ':');
  const m24 = normalizedInput.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let hh = Number(m24[1]);
    const mm = Number(m24[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      const ap = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      return `${hh}:${String(mm).padStart(2, '0')} ${ap}`;
    }
  }

  const m12 = normalizedInput.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (m12) {
    const hh = Number(m12[1]);
    const mm = Number(m12[2]);
    const ap = m12[3].toUpperCase();
    if (hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59) {
      return `${hh}:${String(mm).padStart(2, '0')} ${ap}`;
    }
  }

  return raw;
}

function platformIcon(name: string): string {
  if (name === 'facebook') return 'https://img.icons8.com/color/48/facebook-new.png';
  if (name === 'instagram') return 'https://img.icons8.com/color/48/instagram-new--v1.png';
  if (name === 'linkedin') return 'https://img.icons8.com/color/48/linkedin.png';
  return '';
}

// A post is "morning" only if its time is exactly 6:30 (AM). Every other
// time — including the 09:00 default — is routed to the "evening" webhook.
function isMorningSlot(time: string | null): boolean {
  const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  return Number(m[1]) === 6 && Number(m[2]) === 30;
}

// ------------------------------------------------------------
// n8n response parsing: generate-content and improve webhooks reply with
// [{ "Caption", "Post Date", "Image LInk", "Status", "Title", "time" }]
// (note the "LInk" typo and "6.30 AM"-style time — both handled below).
// ------------------------------------------------------------
function normalizeIncomingTime(raw: string): string {
  const cleaned = String(raw || '').replace('.', ':').trim();
  const m = cleaned.match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return '09:00';
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && hh !== 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeIncomingStatus(raw: string | undefined): PostStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'posted') return 'posted';
  if (s === 'approved' || s === 'scheduled') return 'approved';
  return 'draft'; // covers "Pending" and anything unrecognized
}

function fromDDMMYYYY(raw: string | undefined): string | null {
  const m = String(raw || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(item: any, ...keys: string[]) {
  for (const k of keys) {
    if (item && item[k] !== undefined && item[k] !== null && item[k] !== '') return item[k];
  }
  return undefined;
}

// ============================================================
// Page
// ============================================================
export default function Page() {
  const today = new Date().toISOString().slice(0, 10);

  const [selectedDate, setSelectedDate] = useState(today);
  const [dates, setDates] = useState<DateCount[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState('');
  const [generating, setGenerating] = useState(false);
  const [postTimes, setPostTimes] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<LangCode>('en');
  const [monthView, setMonthView] = useState(new Date());
  const [viewPost, setViewPost] = useState<Post | null>(null);
  const [improvingPostId, setImprovingPostId] = useState<string | null>(null);
  const [showMoreNotice, setShowMoreNotice] = useState('');
  const [notifications, setNotifications] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('post_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [platformsByPost, setPlatformsByPost] = useState<Record<string, string[]>>({});
  const [platformMenuPostId, setPlatformMenuPostId] = useState<string | null>(null);
  const [approveWarnPostId, setApproveWarnPostId] = useState<string | null>(null);
  const [postNowWarnPostId, setPostNowWarnPostId] = useState<string | null>(null);
  const [improveLangByPost, setImproveLangByPost] = useState<Record<string, string>>({});
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [modalCaptionText, setModalCaptionText] = useState('');
  const [modalCaptionLoading, setModalCaptionLoading] = useState(false);
  const [modalIsEditing, setModalIsEditing] = useState(false);
  const [modalDraftCaption, setModalDraftCaption] = useState('');
  const [captionByPost, setCaptionByPost] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const [postNowPendingPostId, setPostNowPendingPostId] = useState<string | null>(null);
  const [postNowSuccessBanner, setPostNowSuccessBanner] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSavedBanner, setFeedbackSavedBanner] = useState('');

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const selectedDateLabel = useMemo(() => fmtDate(selectedDate), [selectedDate]);
  const dateSet = useMemo(() => new Set(dates.map((d) => d.date)), [dates]);
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, 'posted' | 'scheduled'>();
    dates.forEach((d) => {
      if (d.posted_count > 0) map.set(d.date, 'posted');
      else if (d.scheduled_count > 0) map.set(d.date, 'scheduled');
    });
    return map;
  }, [dates]);
  const monthCells = useMemo(() => getMonthGrid(monthView), [monthView]);
  const modalHasChanges = modalDraftCaption !== (modalCaptionText || '');

  // ----------------------------------------------------------
  // Data loading (Supabase)
  // ----------------------------------------------------------
  async function loadDates() {
    const { data, error } = await supabase.from('posts').select('scheduled_date, status');
    if (error) {
      console.error(error);
      return;
    }
    const map = new Map<string, { posted: number; scheduled: number }>();
    (data || []).forEach((row) => {
      const entry = map.get(row.scheduled_date) || { posted: 0, scheduled: 0 };
      if (row.status === 'posted') entry.posted += 1;
      else if (row.status === 'approved' || row.status === 'scheduled') entry.scheduled += 1;
      map.set(row.scheduled_date, entry);
    });
    setDates(
      Array.from(map.entries()).map(([date, c]) => ({
        date,
        posted_count: c.posted,
        scheduled_count: c.scheduled,
      }))
    );
  }

  async function loadPosts(date: string, opts: { silent?: boolean } = {}) {
    if (!opts.silent) {
      setLoading(true);
      setBanner('');
    }
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('scheduled_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const loadedPosts = (data || []) as Post[];
      setPosts(loadedPosts);
      setPlatformsByPost((prev) => {
        const next = { ...prev };
        loadedPosts.forEach((p) => {
          if (Array.isArray(p.platforms) && p.platforms.length) next[p.id] = p.platforms;
          else if (!next[p.id]) next[p.id] = [];
        });
        return next;
      });
      setPostTimes((prev) => {
        const next = { ...prev };
        loadedPosts.forEach((p) => {
          if (!next[p.id]) next[p.id] = p.scheduled_time || '09:00';
        });
        return next;
      });
    } catch (e) {
      console.error(e);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadDates();
    loadPosts(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPosts(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Live updates: replaces the old status-check polling and the manual
  // "wait and re-fetch" loop after Improve — Supabase pushes row changes
  // (n8n writing a new caption/image, or flipping status to 'posted') straight
  // into state.
  useEffect(() => {
    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload: RealtimePostgresChangesPayload<Post>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Post;
            setPosts((prev) => prev.filter((p) => p.id !== oldRow.id));
            return;
          }

          const newRow = payload.new as Post;

          setPosts((prev) => {
            if (newRow.scheduled_date !== selectedDate) {
              return prev.filter((p) => p.id !== newRow.id);
            }
            const exists = prev.some((p) => p.id === newRow.id);
            return exists ? prev.map((p) => (p.id === newRow.id ? newRow : p)) : [...prev, newRow];
          });

          setViewPost((vp) => (vp && vp.id === newRow.id ? newRow : vp));
          loadDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    try {
      localStorage.setItem('post_notifications', JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    if (!platformMenuPostId) return;
    const timer = setTimeout(() => setPlatformMenuPostId(null), 10000);
    return () => clearTimeout(timer);
  }, [platformMenuPostId]);

  useEffect(() => {
    if (!platformMenuPostId) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.platform-picker-wrap')) return;
      setPlatformMenuPostId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [platformMenuPostId]);

  useEffect(() => {
    if (!postNowWarnPostId) return;
    const timeoutId = setTimeout(() => setPostNowWarnPostId(null), 10000);
    const dismiss = () => setPostNowWarnPostId(null);
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('touchstart', dismiss);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
  }, [postNowWarnPostId]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('.notif-wrap')) return;
      setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  useEffect(() => {
    if (!viewPost) {
      setModalCaptionText('');
      setModalCaptionLoading(false);
      return;
    }

    const selected = improveLangByPost[viewPost.id] || 'English';
    const parsed = parseCaptionByLanguage(viewPost.caption);

    if (parsed) {
      const resolved = captionForLanguage(viewPost.caption, selected);
      setModalCaptionText(resolved);
      setCaptionByPost((prev) => ({ ...prev, [viewPost.id]: resolved }));
      setModalCaptionLoading(false);
      return;
    }

    let active = true;
    (async () => {
      setModalCaptionLoading(true);
      try {
        const res = await fetch(N8N_TRANSLATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: viewPost.caption || '', language: selected }),
        });
        const json = await res.json().catch(() => ({}));
        const resolved = json?.translatedText || viewPost.caption || '';
        if (active) {
          setModalCaptionText(resolved);
          setCaptionByPost((prev) => ({ ...prev, [viewPost.id]: resolved }));
        }
      } catch {
        if (active) setModalCaptionText(viewPost.caption || '');
      } finally {
        if (active) setModalCaptionLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [viewPost, improveLangByPost]);

  useEffect(() => {
    if (!viewPost) {
      setModalIsEditing(false);
      setModalDraftCaption('');
      return;
    }
    setModalIsEditing(false);
    setModalDraftCaption(modalCaptionText || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPost?.id, modalCaptionText]);

  useEffect(() => {
    if (!postNowPendingPostId) return;
    const p = posts.find((x) => x.id === postNowPendingPostId);
    if (p && p.status === 'posted') {
      setPostNowPendingPostId(null);
      setPostNowSuccessBanner('Your post is successful.');
    }
  }, [posts, postNowPendingPostId]);

  useEffect(() => {
    if (!postNowSuccessBanner) return;
    const dismiss = () => setPostNowSuccessBanner('');
    const timer = setTimeout(dismiss, 8000);
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('touchstart', dismiss);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
  }, [postNowSuccessBanner]);

  useEffect(() => {
    if (!feedbackSavedBanner) return;
    const dismiss = () => setFeedbackSavedBanner('');
    const timer = setTimeout(dismiss, 8000);
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('touchstart', dismiss);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
  }, [feedbackSavedBanner]);

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------
  async function submitDateFeedback() {
    const note = feedbackText.trim();
    if (!note) return;
    setFeedbackOpen(false);

    await supabase.from('post_feedback').insert({ date: selectedDate, note });

    try {
      await fetch(N8N_FEEDBACK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          feedback: note,
          time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        }),
      });
    } catch {
      // best-effort notification only
    }

    setFeedbackSavedBanner('Feedback saved. Thank you.');
    setFeedbackText('');
  }

  // Inserts the post(s) an n8n webhook responded with (the [{ Caption, "Post
  // Date", "Image LInk", Status, Title, time }] shape) into Supabase. Returns
  // how many rows were inserted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function insertGeneratedPosts(items: any, fallbackDate: string): Promise<number> {
    const list = Array.isArray(items) ? items : items ? [items] : [];
    if (list.length === 0) return 0;

    const rows = list.map((item) => ({
      title: pick(item, 'Title', 'title') || null,
      caption: pick(item, 'Caption', 'caption') || null,
      image_url: pick(item, 'Image LInk', 'Image Link', 'image_url') || null,
      scheduled_date: fromDDMMYYYY(pick(item, 'Post Date', 'post_date')) || fallbackDate,
      scheduled_time: normalizeIncomingTime(pick(item, 'time', 'Time')),
      status: normalizeIncomingStatus(pick(item, 'Status', 'status')),
    }));

    const { error } = await supabase.from('posts').insert(rows);
    if (error) {
      console.error(error);
      return 0;
    }
    return rows.length;
  }

  async function generateContent() {
    setGenerating(true);
    setBanner('');
    try {
      // dd-MM-yyyy, per the n8n workflows' expected format
      const body = JSON.stringify({ date: fmtDate(selectedDate) });
      const [morningRes, eveningRes] = await Promise.all([
        fetch(N8N_GENERATE_CONTENT_MORNING_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        fetch(N8N_GENERATE_CONTENT_EVENING_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      ]);

      const [morningJson, eveningJson] = await Promise.all([
        morningRes.json().catch(() => null),
        eveningRes.json().catch(() => null),
      ]);

      const insertedCount =
        (await insertGeneratedPosts(morningJson, selectedDate)) +
        (await insertGeneratedPosts(eveningJson, selectedDate));

      if (insertedCount > 0) {
        setBanner(`${t.generatedBanner} ${insertedCount} ${t.postsWord} ${fmtDate(selectedDate)}.`);
        await loadDates();
        await loadPosts(selectedDate);
      } else if (morningRes.ok || eveningRes.ok) {
        setBanner('The webhook responded but returned no content to save.');
      } else {
        setBanner('Could not generate content. Check the n8n webhooks.');
      }
    } catch {
      setBanner('Could not reach the n8n webhooks.');
    } finally {
      setGenerating(false);
    }
  }

  // Shared payload for approve / post-now webhooks: date, image, time,
  // status, the currently-active caption (translated/edited if changed),
  // title, and the Google Drive image link.
  function buildActionPayload(post: Post) {
    return {
      date: fmtDate(post.scheduled_date),
      image: post.image_url || '',
      imageDriveLink: post.image_url || '',
      time: postTimes[post.id] || post.scheduled_time || '09:00',
      status: post.status,
      caption: captionByPost[post.id] || post.caption || '',
      title: deriveTitle(post),
    };
  }

  async function postNow(post: Post) {
    const selectedPlatforms = (platformsByPost[post.id] || []).filter(Boolean);
    if (selectedPlatforms.length === 0) {
      setPostNowWarnPostId(post.id);
      return;
    }

    const postNowUrl = isMorningSlot(postTimes[post.id] || post.scheduled_time)
      ? N8N_POST_NOW_MORNING_URL
      : N8N_POST_NOW_EVENING_URL;

    try {
      setPostNowWarnPostId(null);
      setPostNowPendingPostId(post.id);
      const res = await fetch(postNowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, platforms: selectedPlatforms, ...buildActionPayload(post) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.posted) {
        setPostNowPendingPostId(null);
        setPostNowSuccessBanner('Your post is successful.');
        await loadPosts(selectedDate);
        await loadDates();
      }
      // If n8n responds before the actual publish finishes, the Realtime
      // subscription flips postNowPendingPostId -> success once status='posted'.
    } catch {
      setPostNowPendingPostId(null);
    }
  }

  async function approve(post: Post) {
    const selectedPlatforms = (platformsByPost[post.id] || []).filter(Boolean);
    if (selectedPlatforms.length === 0) {
      setApproveWarnPostId(post.id);
      return;
    }

    const { error } = await supabase
      .from('posts')
      .update({
        status: 'approved',
        platforms: selectedPlatforms,
        scheduled_time: postTimes[post.id] || '09:00',
      })
      .eq('id', post.id);

    if (!error) {
      setPlatformMenuPostId(null);
      setBanner(`"${deriveTitle(post)}" ${t.approvedBanner}`);

      const approveUrl = isMorningSlot(postTimes[post.id] || post.scheduled_time)
        ? N8N_APPROVE_MORNING_URL
        : N8N_APPROVE_EVENING_URL;
      try {
        await fetch(approveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: post.id,
            platforms: selectedPlatforms,
            ...buildActionPayload(post),
            status: 'approved',
          }),
        });
      } catch {
        // Supabase row is already updated; the webhook notification failing
        // shouldn't block the UI from reflecting the approval.
      }

      await loadPosts(selectedDate);
      await loadDates();
    }
  }

  async function beginEdit(post: Post): Promise<boolean> {
    const improveUrl = isMorningSlot(postTimes[post.id] || post.scheduled_time)
      ? N8N_IMPROVE_MORNING_URL
      : N8N_IMPROVE_EVENING_URL;
    try {
      const res = await fetch(improveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          date: fmtDate(post.scheduled_date),
          language: improveLangByPost[post.id] || 'English',
        }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const item = Array.isArray(json) ? json[0] : json;

        if (item) {
          const updates: Record<string, unknown> = {};
          const caption = pick(item, 'Caption', 'caption');
          const title = pick(item, 'Title', 'title');
          const imageUrl = pick(item, 'Image LInk', 'Image Link', 'image_url');
          const time = pick(item, 'time', 'Time');
          if (caption !== undefined) updates.caption = caption;
          if (title !== undefined) updates.title = title;
          if (imageUrl !== undefined) updates.image_url = imageUrl;
          if (time !== undefined) updates.scheduled_time = normalizeIncomingTime(time);

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('posts').update(updates).eq('id', post.id);
            if (error) console.error(error);
          }
        }

        setBanner(`"${deriveTitle(post)}" edit request sent.`);
        await loadDates();
        await loadPosts(selectedDate);
        return true; // Realtime also refreshes viewPost once the row above is written
      }
      setBanner('Could not send edit request.');
      return false;
    } catch {
      setBanner('Could not reach the n8n webhook.');
      return false;
    }
  }

  async function saveModalEdit() {
    if (!viewPost) return;
    const postId = viewPost.id;
    const nextCaption = modalDraftCaption || '';

    setModalCaptionText(nextCaption);
    setModalDraftCaption(nextCaption);
    setModalIsEditing(false);

    const { data, error } = await supabase
      .from('posts')
      .update({ caption: nextCaption })
      .eq('id', postId)
      .select()
      .single();

    if (error) return;

    const updated = (data as Post) || { ...viewPost, caption: nextCaption };
    setViewPost(updated);
    setModalCaptionText(updated.caption || nextCaption);
    setModalDraftCaption(updated.caption || nextCaption);
    setCaptionByPost((prev) => ({ ...prev, [postId]: updated.caption || nextCaption }));

    await loadDates();
    await loadPosts(selectedDate, { silent: true });
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <>
      <nav className="top-nav">
        <div className="brand">{t.navTitle}</div>
        <div className="nav-right">
          <label className="lang-wrap" title={t.langLabel}>
            🌐
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LangCode)}
              className="lang-select"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <div className="notif-wrap">
            <button
              className="notif-btn"
              title="Notifications"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((v) => !v);
                setUnreadCount(0);
              }}
            >
              🔔
              {unreadCount > 0 ? <span className="notif-badge">{unreadCount}</span> : null}
            </button>
            {notifOpen ? (
              <div className="notif-panel">
                {notifications.length === 0 ? (
                  <p>{t.noNotifications}</p>
                ) : (
                  notifications.map((n, i) => <p key={i}>{n}</p>)
                )}
              </div>
            ) : null}
          </div>
          <button className="profile-btn" title="Profile" aria-label="Profile">
            👤
          </button>
        </div>
      </nav>

      <div className="layout">
        <aside className="sidebar">
          <h2 className="calendar-title">{t.calendar}</h2>
          <div className="cal-head">
            <button
              className="ghost"
              onClick={() => setMonthView(new Date(monthView.getFullYear(), monthView.getMonth() - 1, 1))}
            >
              ◀
            </button>
            <strong>{monthLabel(monthView, t.locale)}</strong>
            <button
              className="ghost"
              onClick={() => setMonthView(new Date(monthView.getFullYear(), monthView.getMonth() + 1, 1))}
            >
              ▶
            </button>
          </div>
          <div className="weekdays">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>
          <div className="calendar-grid">
            {monthCells.map((d) => {
              const iso = toIsoDate(d);
              const inMonth = d.getMonth() === monthView.getMonth();
              const hasPost = dateSet.has(iso);
              const active = iso === selectedDate;
              const dateStatus = dateStatusMap.get(iso);
              const dateStyle = active
                ? { background: '#0F4C5C', borderColor: '#0F4C5C', color: '#fff' }
                : dateStatus === 'posted'
                ? { background: '#2d5fff', borderColor: '#2d5fff', color: '#fff' }
                : dateStatus === 'scheduled'
                ? { background: '#4caf50', borderColor: '#4caf50', color: '#fff' }
                : undefined;
              return (
                <button
                  key={iso}
                  className={`day-btn ${inMonth ? '' : 'muted'} ${hasPost ? 'has-post' : ''} ${
                    dateStatus === 'posted' ? 'has-post-posted' : ''
                  } ${dateStatus === 'scheduled' ? 'has-post-scheduled' : ''} ${active ? 'active' : ''}`}
                  style={dateStyle}
                  onClick={() => setSelectedDate(iso)}
                  title={hasPost ? t.hasPostsHint : t.noPostsHint}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: '20px',
              fontSize: '12px',
              color: '#2d3a64',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              textAlign: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="calendar-legend-diamond scheduled"
                aria-hidden="true"
                style={{ transform: 'rotate(45deg)' }}
              />
              <span>Scheduled</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="calendar-legend-diamond posted"
                aria-hidden="true"
                style={{ transform: 'rotate(45deg)' }}
              />
              <span>posted</span>
            </span>
          </div>
        </aside>

        <main className="main">
          <header>
            <div className="selected-date-row">
              <p className="selected-date">
                {t.socialMediaPostFor} {selectedDateLabel}
              </p>
              <button
                type="button"
                className="feedback-top-btn btn-white"
                onClick={() => setFeedbackOpen(true)}
              >
                Feedback
              </button>
            </div>
            {postNowPendingPostId ? (
              <div className="banner postnow-pending-banner">
                This post will get posted on. Please wait for a while.
              </div>
            ) : null}
            {postNowSuccessBanner ? (
              <div className="banner postnow-success-banner" onClick={() => setPostNowSuccessBanner('')}>
                Your post is successful.
              </div>
            ) : null}
            {banner && <div className="banner">{banner}</div>}
            {feedbackSavedBanner ? (
              <div className="banner postnow-success-banner" onClick={() => setFeedbackSavedBanner('')}>
                {feedbackSavedBanner}
              </div>
            ) : null}
          </header>

          {loading ? <p>{t.loading}</p> : null}

          <div className="grid">
            {posts.map((post) => (
              <article className="card" key={post.id}>
                <div className="card-row">
                  <div className="image-wrap">
                    <img
                      src={proxiedImageUrl(post.image_url)}
                      alt="Post image"
                      onClick={() => setViewPost(post)}
                      style={{ cursor: 'pointer' }}
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/1200x700?text=Image+unavailable';
                      }}
                    />
                  </div>
                  <div className="card-media">
                    <h3 className="post-title clickable-title" onClick={() => setViewPost(post)}>
                      {deriveTitle(post)}
                    </h3>
                    <div className="schedule-hint-row">
                      <button type="button" className="schedule-hint-btn" disabled aria-disabled="true">
                        {formatCardTime(post.scheduled_time)}
                        {'\u00A0\u00A0\u00A0'}or
                      </button>
                      <div className="approve-wrap post-now-wrap">
                        <button
                          type="button"
                          className="schedule-hint-btn post-now-inline-btn"
                          onClick={() => postNow(post)}
                        >
                          Post Now
                        </button>
                        {postNowWarnPostId === post.id ? (
                          <div className="approve-pop">{t.platformRequiredWarning}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="show-more-btn btn-white" onClick={() => setViewPost(post)}>
                        {t.showMore}
                      </button>

                      <div className="platform-picker-wrap">
                        <button
                          className={`platform-combo-btn btn-white ${
                            (platformsByPost[post.id] || []).length ? 'has-selection' : ''
                          }`}
                          onClick={() => {
                            setApproveWarnPostId(null);
                            setPostNowWarnPostId(null);
                            setPlatformMenuPostId((prev) => (prev === post.id ? null : post.id));
                          }}
                        >
                          <span
                            className={`platform-slot ${
                              (platformsByPost[post.id] || []).length ? 'has-selection' : ''
                            }`}
                          >
                            {(platformsByPost[post.id] || []).length === 0 ? (
                              <span className="platform-placeholder">{t.platform}</span>
                            ) : (
                              (platformsByPost[post.id] || []).map((pl) =>
                                pl === 'discard' ? (
                                  <span key={pl} className="platform-chip discard-chip" title="discard">
                                    Discard
                                  </span>
                                ) : (
                                  <span key={pl} className="platform-chip" title={pl}>
                                    <img src={platformIcon(pl)} alt={pl} />
                                  </span>
                                )
                              )
                            )}
                          </span>
                          {(platformsByPost[post.id] || []).length === 0 ? (
                            <span className="platform-caret">▼</span>
                          ) : null}
                        </button>
                        {platformMenuPostId === post.id ? (
                          <div className="platform-menu">
                            {['facebook', 'instagram', 'linkedin'].map((pl) => {
                              const selected = (platformsByPost[post.id] || []).includes(pl);
                              return (
                                <button
                                  key={pl}
                                  type="button"
                                  className={`platform-option ${selected ? 'selected' : ''}`}
                                  onClick={() => {
                                    setPlatformsByPost((prev) => {
                                      const current = prev[post.id] || [];
                                      const next = selected
                                        ? current.filter((x) => x !== pl)
                                        : [...current, pl];
                                      return { ...prev, [post.id]: next };
                                    });
                                    setPlatformMenuPostId(post.id);
                                  }}
                                >
                                  {pl}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <div className="right-actions">
                        <div className="approve-wrap">
                          <button className="approve-btn" onClick={() => approve(post)}>
                            {t.approve}
                          </button>
                          {approveWarnPostId === post.id ? (
                            <div className="approve-pop">{t.approveWarning}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className={`status-btn ${
                            post.status === 'posted'
                              ? 'status-posted'
                              : post.status === 'approved' || post.status === 'scheduled'
                              ? 'status-scheduled'
                              : 'btn-white'
                          }`}
                        >
                          {post.status === 'posted'
                            ? '✓ Posted'
                            : post.status === 'approved' || post.status === 'scheduled'
                            ? t.scheduledText
                            : t.statusText}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {!loading && posts.length === 0 ? (
              <div className="empty-state">
                <p>{t.noPosts}</p>
                <button onClick={generateContent} disabled={generating}>
                  {generating ? t.triggering : t.generate}
                </button>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {feedbackOpen ? (
        <div className="modal-backdrop" onClick={() => setFeedbackOpen(false)}>
          <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setFeedbackOpen(false)}>
              ✕
            </button>
            <h3 style={{ marginTop: 0 }}>Share feedback</h3>
            <p style={{ marginTop: 0, color: '#5b647e' }}>Tell us why posts are not approved for this date.</p>
            <textarea
              className="feedback-textarea"
              placeholder="Write your feedback..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-white" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </button>
              <button onClick={submitDateFeedback} disabled={!feedbackText.trim()}>
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewPost ? (
        <div className="modal-backdrop">
          <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => {
                setViewPost(null);
                setLangMenuOpen(false);
                setModalIsEditing(false);
                setModalDraftCaption('');
              }}
            >
              ✕
            </button>
            <img
              className="modal-image"
              src={proxiedImageUrl(viewPost.image_url)}
              alt="Post image"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/1200x700?text=Image+unavailable';
              }}
            />
            <div className="modal-lang-row">
              <div className="lang-modal-wrap">
                <button type="button" className="lang-modal-select" onClick={() => setLangMenuOpen((v) => !v)}>
                  {(improveLangByPost[viewPost.id] || 'English') === 'English'
                    ? 'EN'
                    : (improveLangByPost[viewPost.id] || 'English') === 'Bengali'
                    ? 'BD'
                    : 'DE'}{' '}
                  <span className="lang-caret">▼</span>
                </button>
                {langMenuOpen ? (
                  <div className="lang-modal-menu">
                    {[
                      { value: 'English', label: 'EN' },
                      { value: 'Bengali', label: 'BD' },
                      { value: 'German', label: 'DE' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`lang-modal-option ${
                          (improveLangByPost[viewPost.id] || 'English') === opt.value ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setImproveLangByPost((prev) => ({ ...prev, [viewPost.id]: opt.value }));
                          setLangMenuOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="modal-caption-row">
              {modalIsEditing ? (
                <div className="modal-caption-edit-wrap">
                  <button
                    type="button"
                    className="modal-caption-edit-close"
                    onClick={() => {
                      setModalIsEditing(false);
                      setModalDraftCaption(modalCaptionText || '');
                    }}
                    aria-label="Cancel caption edit"
                  >
                    ✕
                  </button>
                  <textarea
                    className="modal-caption-editor"
                    value={modalDraftCaption}
                    onChange={(e) => setModalDraftCaption(e.target.value)}
                  />
                </div>
              ) : (
                <p className="modal-caption">{modalCaptionLoading ? 'Translating...' : modalCaptionText}</p>
              )}
            </div>
            <div className="modal-actions">
              {modalIsEditing && modalHasChanges ? (
                <button className="improve-btn" onClick={saveModalEdit}>
                  Save
                </button>
              ) : (
                <>
                  <button
                    disabled={improvingPostId === viewPost.id}
                    className={improvingPostId === viewPost.id ? 'improve-btn loading' : 'improve-btn'}
                    onClick={async () => {
                      const currentPost = viewPost;
                      setImprovingPostId(currentPost.id);
                      const ok = await beginEdit(currentPost);
                      setImprovingPostId(null);
                      if (ok) {
                        const now = new Date();
                        const datePart = now.toLocaleDateString();
                        const timePart = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const notice = `${firstFourWords(deriveTitle(currentPost))}... improved on ${datePart} ${timePart}`;
                        setNotifications((prev) => [notice, ...prev]);
                        setUnreadCount((n) => n + 1);
                        setShowMoreNotice(notice);
                        setTimeout(() => setShowMoreNotice(''), 6500);
                        // no manual polling needed — Realtime updates viewPost when n8n rewrites the row
                      }
                    }}
                  >
                    Improve
                  </button>
                  <button
                    className="improve-btn"
                    onClick={() => {
                      const currentScrollTop = modalRef.current ? modalRef.current.scrollTop : 0;
                      setModalIsEditing(true);
                      setModalDraftCaption(modalCaptionText || '');
                      requestAnimationFrame(() => {
                        if (modalRef.current) modalRef.current.scrollTop = currentScrollTop;
                      });
                    }}
                  >
                    {t.edit}
                  </button>
                </>
              )}
              {improvingPostId === viewPost.id ? <span className="spinner" aria-label="loading" /> : null}
            </div>
          </div>
        </div>
      ) : null}

      {showMoreNotice ? (
        <div className="screen-notice" onClick={() => setShowMoreNotice('')}>
          {showMoreNotice}
        </div>
      ) : null}
    </>
  );
}