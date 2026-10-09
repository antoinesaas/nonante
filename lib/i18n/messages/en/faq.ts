import type { faq as fr } from "@/lib/i18n/messages/fr/faq";

export const faq: typeof fr = {
  title: "Frequently asked questions.",
  hand: "everything people ask us",
  metaTitle: "FAQ",
  metaDescription: "How a 90-day arc works, proofs, prices, refunds, data.",
  other: "Another question?",
  write: "Write to us at {email}, we'll answer you personally.",
  groups: [
    {
      title: "The idea",
      items: [
        {
          id: "quoi",
          q: "What is Nonante?",
          a: "A 90-day arc to reach a precise goal: revenue, clients, a launch, an exam. You follow “if… then…” principles built for your goal, and you prove them every day. Your proofs raise your player stats, your level and your place on the leaderboard.",
        },
        {
          id: "pourquoi-90",
          q: "Why 90 days?",
          a: "It's long enough for a habit to become automatic (66 days on average according to a University College London study, Lally et al., 2010) and short enough to keep the finish line in sight. A quarter is also the right horizon for a business goal.",
        },
        {
          id: "principes",
          q: "Where do the principles come from?",
          a: "From a library of proven principles: “if… then…” plans, deep work, “eat the frog”, the 2-minute rule, daily prospecting, a fixed wake-up time… Nonante picks the 6 that fit your goal, your business or school and your weak points. You can edit them all, add more or write your own from scratch.",
        },
        {
          id: "quand",
          q: "When can I start?",
          a: "Whenever you want: today, tomorrow, next Monday, a specific date, or by joining a party: everyone starts on the same day (an official party per profile starts every Monday, and anyone can create their own). Your arc lasts 90 days from your day 1.",
        },
        {
          id: "temps",
          q: "How much time does it take each day?",
          a: "It depends on the principles you keep. A proof takes a few seconds (photo, code, button); only focus sessions last 25, 50 or 90 minutes, and that's work you would have done anyway, without your phone.",
        },
      ],
    },
    {
      title: "Proofs",
      items: [
        {
          id: "preuves",
          q: "How do I prove things?",
          a: "Depending on the principle: a timer that breaks if you leave the screen, the camera counting your push-ups or squats, a code to copy when you wake up, a photo taken in the app, a screenshot or a link. A strong proof earns all the points, a weak proof half.",
        },
        {
          id: "triche",
          q: "What if someone cheats?",
          a: "Some weak proofs are checked at random: you then have to send a photo within 24 hours. A rejected proof costs three times its value and stays visible on the profile. Cheating in a game against yourself mostly means stealing 90 days from yourself.",
        },
        {
          id: "camera",
          q: "Does the camera record what I do?",
          a: "No. Push-ups and squats are counted on your phone; no image is sent. Only the proof photos you choose to send are stored, in a private space, and deleted after 30 days.",
        },
        {
          id: "rate",
          q: "What if I miss a day?",
          a: "You lose points, and your streak resets. Missing two days in a row costs more (“never twice”). You also have jokers: a joker makes a day neutral, with no points and no penalty. An arc is held with 75 green days out of 90.",
        },
      ],
    },
    {
      title: "Price and payment",
      items: [
        {
          id: "payant",
          q: "Why isn't it free?",
          a: "Because a free arc gets dropped on the first tough evening. Putting money on the table is already a commitment: one more reason to hold on. And it's what lets the app grow, with no ads at all.",
        },
        {
          id: "choisir",
          q: "90-day Arc, Pro or Founder: which one?",
          a: "The 90-day Arc (€19.99 once) is enough for a full arc: 6 principles, every proof, the leaderboard, squads, and the income wallet (business arc) or the grade book (study arc). Pro (€14.99 a month or €99.99 a year) is made for arc after arc, with 12 principles, the wallet and grade book whatever the arc, 3 jokers and squad creation. Founder is Pro for life in one payment, for the first 100.",
        },
        {
          id: "renouvellement",
          q: "Does the 90-day Arc renew automatically?",
          a: "No. It's a one-off payment for one 90-day arc. Nothing is charged afterwards: you launch your next arc whenever you want. Only Pro is a subscription, cancellable in one click.",
        },
        {
          id: "retractation",
          q: "Can I get a refund?",
          a: "You have 14 days to withdraw. Since you ask to start right away, only the part already used is due, pro rata to the days elapsed. Just write to the address given in the terms of sale.",
        },
        {
          id: "parrainage",
          q: "How does referral work?",
          a: "Every player has a link and a code to share. If you sign up thanks to a friend, you both get −20%: you on your first payment, them on their next arc (or next Pro invoice). The discount applies automatically.",
        },
        {
          id: "remises",
          q: "Are there other discounts?",
          a: "Yes, the same for everyone: if you hold your arc, your next 90-day Arc (or your next Pro invoice) is −50%.",
        },
        {
          id: "classement-argent",
          q: "Can you win money on the leaderboard?",
          a: "No. The leaderboard, levels and achievements give points, titles and backgrounds for your player card, never money or prizes. The wallet is for tracking what you earn with your own project.",
        },
      ],
    },
    {
      title: "Practical",
      items: [
        {
          id: "installer",
          q: "Do I need to install an app?",
          a: "No need: Nonante works right now in your phone's browser. To have it like an app, add it to your home screen (Share, then “Add to Home Screen” on iPhone). The iPhone app is coming soon to the App Store, with the same account.",
        },
        {
          id: "donnees",
          q: "What do you do with my data?",
          a: "Only what's needed to run your arc: your email, your answers, your proofs. No ads, no tracking cookies. You can export or delete your account at any time from your profile.",
        },
        {
          id: "public",
          q: "What can others see about me?",
          a: "If your profile is public: your username, photo, player card, calendar, country and achievements. Your goal and wallet only if you choose. If private, you appear as “Anonymous” on the leaderboard.",
        },
      ],
    },
  ],
};
