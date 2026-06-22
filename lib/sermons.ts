// Sermon library data + lookup helpers.
// Recreated faithfully from the Claude Design prototype (Preach The Word.dc.html).

export type ThemeKey =
  | 'mission'
  | 'discipleship'
  | 'future'
  | 'salvation'
  | 'repentance';

export interface Theme {
  key: ThemeKey;
  /** URL slug for /themes/[theme]. */
  slug: string;
  name: string;
  blurb: string;
}

export interface Sermon {
  id: string;
  /** URL slug for /sermons/[slug] (derived from the title, SEO-friendly). */
  slug: string;
  videoId: string;
  title: string;
  /** Scripture reference, e.g. "Ephesians 3". */
  ref: string;
  preacher: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  category: ThemeKey;
  featured?: boolean;
  tags: string[];
  short: string;
  long: string[];
  transcript: string;
}

// Five streams every message flows through. Order is intentional.
export const THEMES: Theme[] = [
  {
    key: 'mission',
    slug: 'mission',
    name: 'Mission',
    blurb: "God's heart for the nations and our part in His unfolding plan.",
  },
  {
    key: 'discipleship',
    slug: 'discipleship',
    name: 'Discipleship',
    blurb: 'Growing as a follower of Jesus — day by day, to the very end.',
  },
  {
    key: 'future',
    slug: 'future',
    name: 'Future Hope',
    blurb: 'The promises that anchor us — Christ’s return and the life to come.',
  },
  {
    key: 'salvation',
    slug: 'salvation',
    name: 'Salvation',
    blurb: 'How God rescues the lost and makes all things new.',
  },
  {
    key: 'repentance',
    slug: 'repentance',
    name: 'Repentance',
    blurb: 'Turning back to God with a whole and tender heart.',
  },
];

// Quick "Looking for a word on…" entry points on the home page.
export const NEED_TAGS: string[] = [
  'Finishing strong',
  'Doubt',
  'New birth',
  'God’s purpose',
  'Repentance',
  'Self-examination',
  'The Holy Spirit',
  'Brokenness',
];

export const SERMONS: Sermon[] = [
  {
    id: 's1',
    slug: 'gods-open-secret',
    videoId: 'XhiPW7-m7vs',
    title: "God's Open Secret",
    ref: 'Ephesians 3',
    preacher: 'Rev. Joe Thomas',
    date: '2026-06-15',
    category: 'mission',
    featured: true,
    tags: ['God’s purpose', 'The church', 'Mystery of grace', 'Mission'],
    short:
      "Paul unveils the 'mystery' hidden for ages — that the gospel is for all peoples — and what it means to be caught up in God’s eternal plan.",
    long: [
      'For generations it was kept hidden, and then it was revealed: God’s purpose was never for one nation alone, but for every people on earth to be brought near through Christ. In Ephesians 3 Paul calls this the ‘mystery’ — now made known through the church.',
      'This message walks through what that open secret means for us: that we are not bystanders to God’s plan but participants in it. The same grace that reached Paul reaches us, and the same commission rests on the whole people of God.',
      'It closes with Paul’s prayer — that we would grasp how wide and long and high and deep the love of Christ is, and be filled with the fullness of God.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… There is a secret that God kept hidden for ages and generations, but now, Paul says, it has been made known. And what is that secret? That the nations — the Gentiles — are fellow heirs, members of the same body, partakers of the promise in Christ Jesus through the gospel.\n\nBeloved, you and I are part of that mystery this morning. We were once far off, and we have been brought near. So the question is not only ‘what has God done for me’ but ‘what is God doing through me’ for the sake of the nations…',
  },
  {
    id: 's2',
    slug: 'finishing-well',
    videoId: 'CyYCgPndIcc',
    title: 'Finishing Well',
    ref: '2 Timothy 2:8',
    preacher: 'Rev. Joe Thomas',
    date: '2026-06-08',
    category: 'discipleship',
    tags: ['Finishing strong', 'Perseverance', 'Faithfulness', 'Endurance'],
    short:
      'What does it take to run the race of faith all the way to the end? A call to endurance — remembering Jesus Christ, raised from the dead.',
    long: [
      'It is one thing to begin the journey of faith; it is another to finish it well. Paul, writing near the end of his own life, charges Timothy to keep going — to remember Jesus Christ and to hold the line when it costs him something.',
      'This message looks honestly at why many start strong and fade, and at the disciplines that keep a believer steady: a clear gaze on Christ, a willingness to suffer for the gospel, and the assurance that the word of God is never chained.',
      'The encouragement is simple and bracing — the One who began a good work will carry it to completion. Finish well.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… Remember Jesus Christ, risen from the dead, the offspring of David — this is my gospel, Paul says. Why does he say ‘remember’? Because in the heat of the race it is the easiest thing in the world to forget.\n\nFinishing well is not about how you start. It is about whether you are still standing, still trusting, still proclaiming, when the road has been long…',
  },
  {
    id: 's3',
    slug: 'the-significance-of-the-holy-spirit',
    videoId: 'ZtjLm6M-5Xg',
    title: 'The Significance of the Holy Spirit',
    ref: 'Acts 1–2',
    preacher: 'Pastor Joe Thomas',
    date: '2026-06-01',
    category: 'mission',
    tags: ['The Holy Spirit', 'Power to witness', 'Pentecost', 'Mission'],
    short:
      'Why the Holy Spirit is not optional but essential — the promised power for every believer and the very life of the church.',
    long: [
      'Before He ascended, Jesus told the disciples to wait — not to work, not to strategise, but to wait for the promise of the Father. Why? Because the mission of God cannot be carried in human strength alone.',
      'This message unfolds the significance of the Holy Spirit: He is the One who convicts, who comforts, who empowers ordinary people to be witnesses. Pentecost was not a one-time spectacle but the birth of a Spirit-filled people.',
      'The invitation is to stop running on empty — to receive afresh the power God has promised, for a life and a witness that the world cannot explain.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… You shall receive power when the Holy Spirit has come upon you, and you shall be my witnesses. Notice He does not say you shall receive a feeling, or an experience for its own sake. He says power — power for a purpose.\n\nThe Holy Spirit is not an optional extra to the Christian life. He is the life…',
  },
  {
    id: 's4',
    slug: 'the-lessons-from-judas-iscariot',
    videoId: 'UMEM6j2iyAk',
    title: 'The Lessons from Judas Iscariot',
    ref: 'Matthew 26',
    preacher: 'Rev. Joe Thomas',
    date: '2026-05-25',
    category: 'discipleship',
    tags: ['Self-examination', 'The heart', 'Warning', 'Discipleship'],
    short:
      'Three sobering lessons from Judas: you can be near to Jesus, sympathetic, and outwardly washed — and yet not truly belong to Him.',
    long: [
      'Few figures in Scripture are as searching as Judas. He walked with Jesus for three years, heard every sermon, saw every miracle — and still betrayed Him. This message draws out three lessons we dare not ignore.',
      'First, Judas participated, but he was never part of the family. Second, he was sympathetic, but he was not sincere. Third, he was washed on the outside, but he was never clean within.',
      'The aim is not to point fingers at Judas, but to turn the light inward — to ask the Lord, as the disciples did, ‘Is it I?’ and to let Him search and settle our hearts.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… When Jesus said one of you will betray me, the disciples did not point at Judas. Each one asked, ‘Lord, is it I?’ That is the posture of a tender heart.\n\nJudas teaches us that proximity to Jesus is not the same as a relationship with Jesus. You can sit in the room, sing the songs, and still have a heart that is far away…',
  },
  {
    id: 's5',
    slug: 'nicodemus-from-darkness-to-light',
    videoId: 'ZxgAgwgzusA',
    title: 'Nicodemus: From Darkness to Light',
    ref: 'John 3',
    preacher: 'Joe Thomas',
    date: '2026-05-18',
    category: 'salvation',
    tags: ['New birth', 'Doubt', 'Seeking God', 'Salvation'],
    short:
      'A respected teacher comes to Jesus by night, full of questions — and hears the words that have led millions to new life: you must be born again.',
    long: [
      'Nicodemus had everything religion could offer — knowledge, status, sincerity — and still something was missing. He comes to Jesus under cover of darkness, and Jesus meets him with words that cut to the heart: unless one is born again, he cannot see the kingdom of God.',
      'This message traces Nicodemus’ journey from darkness toward light, and shows that salvation is not reform but rebirth — a work only God’s Spirit can do.',
      'It lands on the most loved verse in all Scripture: for God so loved the world that He gave His only Son. The new birth is offered freely to anyone who will believe.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… Nicodemus came to Jesus by night. Maybe out of fear, maybe out of hunger — but he came. And Jesus does not flatter him. He tells him plainly: you must be born again.\n\nReligion can polish the outside. Only God can give a new birth…',
  },
  {
    id: 's6',
    slug: 'the-agony-of-the-king',
    videoId: 'KXmbpsItQFQ',
    title: 'The Agony of the King',
    ref: 'Luke 19:41–44',
    preacher: 'Rev. Joe Thomas',
    date: '2026-05-11',
    category: 'repentance',
    tags: ['Repentance', 'Brokenness', 'The cross', 'Hardness of heart'],
    short:
      'Jesus weeps over a city that missed its moment of visitation. A searching message on hardness of heart and the call to return while there is still time.',
    long: [
      'As the crowds cheered, the King wept. Luke records that Jesus came near, saw the city, and wept over it — because it did not recognise the time of God’s coming to it.',
      'This message sits in that agony, and asks the uncomfortable question: are there places in our own hearts that have grown hard, that have missed His visitation? The tears of Jesus are not weakness — they are the heart of God toward people who have wandered.',
      'The call is to repentance — not a grovelling fear, but a homecoming. While it is still called today, the door of return stands open.',
    ],
    transcript:
      '[Auto-generated transcript excerpt — replace with the full transcript]\n\n… And when he drew near and saw the city, he wept over it. The King is weeping. Not over His own suffering that lies ahead, but over a people who would not come home.\n\nWould you know, even today, the things that make for your peace? The agony of the King is the mercy of God reaching for a hardened heart…',
  },
];

// ---------------------------------------------------------------------------
// Lookups & helpers
// ---------------------------------------------------------------------------

const themeByKey = new Map(THEMES.map((t) => [t.key, t]));
const sermonBySlug = new Map(SERMONS.map((s) => [s.slug, s]));

export function getTheme(key: string): Theme | undefined {
  return themeByKey.get(key as ThemeKey);
}

export function themeName(key: ThemeKey): string {
  return themeByKey.get(key)?.name ?? 'Message';
}

export function getSermon(slug: string): Sermon | undefined {
  return sermonBySlug.get(slug);
}

export function thumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function thumbUrlHd(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function watchUrl(videoId: string): string {
  return `https://youtu.be/${videoId}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

/** Most recent first. */
export function sermonsByDate(list: Sermon[] = SERMONS): Sermon[] {
  return [...list].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function featuredSermon(): Sermon {
  return SERMONS.find((s) => s.featured) ?? SERMONS[0];
}

export function latestSermons(excludeId?: string): Sermon[] {
  return sermonsByDate(SERMONS.filter((s) => s.id !== excludeId));
}

export function sermonsInTheme(key: ThemeKey): Sermon[] {
  return sermonsByDate(SERMONS.filter((s) => s.category === key));
}

export function themeCount(key: ThemeKey): number {
  return SERMONS.filter((s) => s.category === key).length;
}

export function themeCountLabel(key: ThemeKey): string {
  const n = themeCount(key);
  return n === 0 ? 'Coming soon' : n === 1 ? '1 message' : `${n} messages`;
}

export function relatedSermons(sermon: Sermon): Sermon[] {
  return sermonsByDate(
    SERMONS.filter((s) => s.category === sermon.category && s.id !== sermon.id),
  );
}

/** Filter by a "need" tag (matches tags, title, or summary). */
export function sermonsForTag(tag: string): Sermon[] {
  const t = tag.toLowerCase();
  return sermonsByDate(
    SERMONS.filter(
      (s) =>
        s.tags.some((x) => x.toLowerCase().includes(t)) ||
        s.title.toLowerCase().includes(t) ||
        s.short.toLowerCase().includes(t),
    ),
  );
}

/** Free-text search across title, summary, body, tags, theme, and reference. */
export function searchSermons(query: string): Sermon[] {
  const q = query.toLowerCase();
  return sermonsByDate(
    SERMONS.filter((s) =>
      `${s.title} ${s.short} ${s.long.join(' ')} ${s.tags.join(' ')} ${themeName(
        s.category,
      )} ${s.ref}`
        .toLowerCase()
        .includes(q),
    ),
  );
}
