import type { landing as fr } from "@/lib/i18n/messages/fr/landing";

export const landing: typeof fr = {
  label: "Students and entrepreneurs",
  title1: "90 days.",
  title2: "Zero excuses.",
  hand: "not motivation, discipline",
  intro: "One goal, principles built for you, and one proof every day. Your progress turns into player stats to level up.",
  ctaHint: "2 minutes of questions · see your arc before you pay",
  live: "{players|# player|# players} · {arcs|# arc|# arcs} running right now.",
  pains: {
    title: "You know what you have to do.",
    hand: "the hard part is doing it every day",
    items: [
      "You open TikTok “for two minutes”, and the evening is gone.",
      "You put off the important task a little more every day.",
      "You polish your product instead of going out to find clients.",
      "You start three projects at once and finish none of them.",
      "You start strong on Monday; by Thursday, nothing's left.",
    ],
    outro: "Motivation always fades. Discipline is built: clear rules, and one proof every day.",
  },
  steps: {
    label: "How it works",
    title: "Four steps. Ninety days.",
    items: [
      { title: "Your goal", text: "A number, a date: €3,000 a month, 10 clients, your exam. Shown at the top of every screen." },
      {
        title: "Your principles",
        text: "“If I sit down at my desk, then 50 minutes without my phone.” Suggested for your goal and weak points, then 100% editable.",
      },
      { title: "One proof a day", text: "Nothing is validated on your word. The camera counts your push-ups, the timer watches your focus." },
      { title: "Max out your stats", text: "Discipline, Focus, Business, Body, Mind, Energy. An overall rating, levels, a leaderboard." },
    ],
  },
  card: {
    label: "Sample player card",
    subtitle: "day 23/90",
    text: "Six stats calculated over your last 30 days. To raise your rating, you can't neglect anything. Your card can be shared with one link.",
  },
  proofs: {
    label: "Proofs",
    title: "Nothing is validated on your word.",
    items: [
      { title: "Timer", text: "25, 50 or 90 minutes. Leave the screen for more than 10 seconds: the session breaks." },
      { title: "Camera", text: "Push-ups and squats counted by AI, on your phone. No image ever leaves it." },
      { title: "Wake-up", text: "A code to copy before your wake-up time. Impossible to cheat from your bed." },
      { title: "Photo, screenshot, link", text: "The gym, your prospecting messages, your post. Random checks." },
    ],
  },
  calendar: {
    label: "Example: day 23",
    text: "One dot per day. Green: everything proven. Red: a proof is missing. White: you did nothing, and it costs double. A joker, and the day doesn't count.",
  },
  wallet: {
    label: "Wallet",
    title: "Your money, proven.",
    text: "Every euro earned through your project, with a screenshot as proof. It raises your Business stat, unlocks achievements and tracks your income goal. Nonante doesn't pay you: your project does.",
  },
  squads: {
    label: "Leaderboard and squads",
    title: "Alone, you give up. In a squad, you hold on.",
    text: "A leaderboard for the week, the month and all time, worldwide or in your country. Create a squad with your partners or classmates: you'll soon see who really holds on.",
  },
  compare: {
    title: "Not just another habit app.",
    elsewhere: "Elsewhere",
    rows: [
      ["Validation", "A checkbox", "A proof: camera, timer, code"],
      ["Principles", "The same for everyone", "Built for your goal"],
      ["Your business", "Nothing", "Prospecting, income wallet"],
      ["Progress", "A streak", "6 stats, a rating, levels"],
      ["Others", "Alone", "Leaderboard and squads"],
    ],
  },
  why: {
    title: "Why it works.",
    text: "No miracle recipe: proven methods, applied every day.",
  },
  price: {
    title: "Paying is already committing.",
    text: "No free version: a free arc gets dropped on the first tough evening. Build your arc for free, see your principles, then launch it.",
    perDay: "That's {price} a day. No subscription, nothing renews by itself.",
    more: "See also Pro and Founder",
  },
  faqTitle: "Questions.",
  final: {
    hand: "your day 1 is whenever you want",
    title: "In 90 days, you'll be glad you started today.",
    hint: "2 minutes · no card needed to build your arc",
  },
};
