import type { LegalSet } from "@/lib/legal-docs/types";

export const en: LegalSet = {
  notice: "This translation is provided for convenience. The French version is the reference and prevails in case of difference.",

  mentions: {
    title: "Legal notice",
    updated: "",
    blocks: [
      { h2: "Publisher" },
      { p: "The Nonante website and app are published by {name}, {address}." },
      { p: "Contact: {email}" },
      { h2: "Publication director" },
      { p: "{name}." },
      { h2: "Hosting" },
      { p: "Website hosted by Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States (privacy@vercel.com)." },
      {
        p: "Database, authentication and files hosted by Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (privacy@supabase.com).",
      },
      { h2: "Intellectual property" },
      { p: "The Nonante brand, texts, logo and app code belong to their publisher. Any reproduction without permission is prohibited." },
      {
        p: "The images shown are photographs under a CC0 licence or marked “public domain”, public domain works and a few images provided by the publisher. Their authors and sources are listed on the [Photo credits](/art) page. Quotes of the day come from public domain authors; translations are by Nonante.",
      },
      { h2: "Report content" },
      { p: "Every public profile has a “Report” button. You can also write to {email}." },
    ],
  },

  cgu: {
    title: "Terms of use",
    updated: "Effective 9 October 2026.",
    blocks: [
      {
        p: "These terms govern the use of the Nonante website and app, published by {name}, {address} (contact: {email}). Payment terms are in the [terms of sale](/legal/cgv), data processing in the [privacy policy](/legal/confidentialite).",
      },
      { h2: "1. The service" },
      {
        p: "Nonante supports a 90-day arc: a goal, personalised “if… then…” principles, daily proofs, player stats, a leaderboard, squads and, depending on the arc, an income wallet or a grade book. The questionnaire and the plans page are available without an account; everything else requires an account and a paid plan.",
      },
      { h2: "2. Access and account" },
      {
        ul: [
          "Nonante is for adults only (18 or older).",
          "Accounts are created with a Google account, with no Nonante-specific password. You are responsible for access to your Google account.",
          "One account per person. Disposable email addresses are not accepted.",
          "Your username and profile photo must not impersonate anyone, nor be insulting, discriminatory, sexual or unlawful.",
        ],
      },
      { h2: "3. The rules of the game" },
      {
        p: "The rules (points, proofs, jokers, quests, levels, leaderboard, arc held or dropped) are described in the app and in the [FAQ](/faq). They are applied by the server, on Paris time, in the same way for everyone. Nonante may adjust them to fix an imbalance or a loophole; a change never removes points earned honestly.",
      },
      { h2: "4. Proofs" },
      {
        ul: [
          "A proof must match what you actually did, on the same day.",
          "Some weak proofs are checked at random. A rejected proof triggers the penalties set by the rules and stays counted on your profile.",
          "Forbidden: bypassing the timer, the camera or the wake-up code, reusing someone else's proof, automating validations, exploiting a loophole instead of reporting it.",
          "Leaving the timer screen (more than 10 seconds, going back, closing) breaks the session, with the set penalty.",
          "Camera counting happens on your device; no image is sent. The proof photos you send are private and deleted after 30 days.",
        ],
      },
      { h2: "5. Your content" },
      {
        p: "You remain the owner of what you post (profile photo, bio, proofs, links, grades). You allow Nonante to store it, display it according to your settings (public or private) and check it, only to run the service and for as long as necessary. Only post content you have the rights to, and no photo of another person without their consent.",
      },
      { h2: "6. Public profiles, leaderboard and squads" },
      {
        ul: [
          "If your profile is public, your username, photo, player card, calendar, country and achievements are visible to everyone; your goal and wallet only if you choose so. If private, you appear as “Anonymous”.",
          "The leaderboard, levels and achievements give no right to any cash prize or reward. The wallet is a personal tracker: Nonante pays, holds and transfers no money.",
          "Every profile can be reported. After review, a profile may be hidden and an account suspended or closed for breach of these terms. You can contest a decision by writing to {email}.",
        ],
      },
      { h2: "7. Health and advice" },
      {
        p: "Sport principles (push-ups, squats, running…) and sleep principles are practised at your own risk, according to your physical condition; ask a doctor if in doubt. Business, trading and study principles are organisation methods, not financial, investment, legal or medical advice. Nonante does not guarantee you will reach your goal: you are the one who holds it.",
      },
      { h2: "8. Availability" },
      {
        p: "Nonante does its best to keep the service available and secure. Interruptions may occur for maintenance or if a provider fails; if an outage prevents you from validating a proof, write to {email}: the day can be corrected after checking.",
      },
      { h2: "9. Intellectual property" },
      {
        p: "The Nonante brand, logo, texts, game rules and app code are protected. Images come from royalty-free sources, the public domain or the publisher, credited on the [Photo credits](/art) page.",
      },
      { h2: "10. Closing your account" },
      {
        p: "You can export your data and delete your account at any time from your profile. Deletion erases your profile, principles, proofs, grades, points and photos; payment records are kept, detached from your account, for accounting obligations.",
      },
      { h2: "11. Changes" },
      {
        p: "These terms may change. Significant changes are announced in the app at least 15 days before they apply; if you disagree, you can delete your account.",
      },
      { h2: "12. Governing law" },
      {
        p: "These terms are governed by French law. In case of disagreement, first write to {email} to find an amicable solution; the remedies set out in the terms of sale apply.",
      },
    ],
  },

  cgv: {
    title: "Terms of sale",
    updated: "Effective 8 October 2026.",
    blocks: [
      { h2: "1. Seller" },
      { p: "{name}, {address}. Contact: {email}." },
      { h2: "2. The service" },
      {
        p: "Nonante is a web app that supports a 90-day arc: a goal, personalised “if… then…” principles, daily proofs (timer, camera rep counting, wake-up code, photo, screenshot, link), stats, a leaderboard and squads. The service is available in a browser, on phone or computer.",
      },
      { h2: "3. Plans and prices" },
      {
        ul: [
          "90-day Arc: €19.99 in a single payment, for one 90-day arc (from the day 1 you choose). No subscription: nothing is charged afterwards. Each new arc is paid when you launch it. The wallet is included in business arcs, the grade book in study arcs.",
          "Pro: subscription at €14.99 per month, or €99.99 per year, covering every arc while it is active.",
          "Founder: €199 in a single payment, access to the Pro plan with no time limit, limited to 100 places.",
        ],
      },
      {
        p: "Prices are in euros, all taxes included. The content of each plan is described on the Plans page at the time of order. A price change never applies to an arc or period already paid; for a running subscription, it is announced at least 30 days in advance and you can cancel before it applies.",
      },
      {
        p: "The 90-day Arc covers the arc it was paid for, until its 90th day or until it is dropped under the rules (7 blank days in a row). If paid with no arc being built, it is kept as a credit for your next arc.",
      },
      { h2: "4. Order and payment" },
      {
        p: "Payment is processed by Stripe. Nonante never has access to your card numbers. The monthly or yearly Pro subscription renews automatically at the end of each period, at the current price, until cancelled. The 90-day Arc and the Founder plan never renew. An invoice is available for each payment in your billing area (Profile, then “My invoices” or “Manage my subscription”).",
      },
      { h2: "5. Cancelling Pro" },
      {
        p: "You can cancel Pro at any time, in one click, from your profile. Cancellation takes effect at the end of the period already paid: your access stays open until then, and no new charge is made. Started periods are not refunded, except when exercising the right of withdrawal (section 6).",
      },
      { p: "Without an active subscription, your arc keeps running but no proof can be validated: days become blank, under the rules." },
      { h2: "6. Right of withdrawal" },
      {
        p: "You have 14 days from your purchase (90-day Arc, Pro or Founder) to withdraw, without giving any reason (articles L221-18 et seq. of the French Consumer Code). When paying, you expressly ask for the service to start immediately. If you withdraw within these 14 days, you only pay for the part of the service already provided until your withdrawal, pro rata (article L221-25), and the rest is refunded within 14 days, using the same payment method.",
      },
      { p: "To withdraw, send a clear statement to {email}, for example using the template below." },
      {
        quote:
          "To {name}, {address}, {email}: I hereby give notice that I withdraw from the contract for the Nonante service below. Plan: … Purchased on: … Name and email address of the account: … Date: …",
      },
      { h2: "7. Discounts" },
      {
        ul: [
          "Referral: a player's link or code gives −20% on a new player's first payment; the referrer in turn gets −20% on their next 90-day Arc, or on their next Pro invoice if subscribed. One discount per referred player, only one discount per payment.",
          "Loyalty: a held arc gives −50% on the next 90-day Arc, or on the next Pro invoice, once per arc.",
        ],
      },
      { p: "These discounts are the same for everyone, have no cash value and are never linked to the leaderboard." },
      { h2: "8. Leaderboard and game" },
      {
        p: "The leaderboard, levels and achievements only give points, titles and backgrounds for the player card. No cash prize or reward is given. The wallet is a personal tracker of what you earn with your own project: Nonante pays and holds no money.",
      },
      { h2: "9. Code of conduct" },
      {
        p: "Proofs must be real. A proof rejected during a check triggers the penalties set by the rules. Fraudulent behaviour, an offensive username or profile photo may lead to the profile being hidden or the account being closed.",
      },
      { h2: "10. Health" },
      {
        p: "Sport principles (push-ups, squats, running…) are practised at your own risk, according to your physical condition. If in doubt, ask a doctor. Nonante gives no medical advice.",
      },
      { h2: "11. Liability" },
      {
        p: "Nonante commits to providing the service with care and keeping it available as well as possible. Occasional interruptions may occur for maintenance. The publisher's liability is limited to direct, proven damage, up to the amounts paid during the last 12 months.",
      },
      { h2: "12. Personal data" },
      { p: "How your data is processed is described in the [privacy policy](/legal/confidentialite)." },
      { h2: "13. Disputes" },
      {
        p: "These terms are governed by French law. If there is a problem, first write to {email}: we will look for an amicable solution. You can also use a consumer mediator free of charge (articles L611-1 et seq. of the French Consumer Code); their details are provided on request. Failing agreement, the French courts have jurisdiction.",
      },
    ],
  },

  privacy: {
    title: "Privacy",
    updated: "Effective 9 October 2026.",
    blocks: [
      { h2: "Data controller" },
      { p: "{name}, {address}. For any question about your data: {email}." },
      { h2: "What is collected, and why" },
      {
        ul: [
          "Your email address: to sign you in and send you service messages. Sign-in goes through Google: Nonante receives your Google account's email address, name and profile picture, nothing else.",
          "Your username, year of birth (to check you are 18), profile photo and bio if you add them.",
          "Your language and country (derived from your connection, at country level only): to show the app in your language and the leaderboard by country.",
          "Your questionnaire answers (profile, business, school, goal, weak points, rhythm, sport, day 1): they build your arc. If you give them before having an account, they are kept with your email for 3 days at most, while you sign in, then deleted.",
          "Your goal, principles, validations, sessions, points and stats: that's the game.",
          "Your proofs: photos taken in the app, screenshots, links. They are used for checks and stay private.",
          "Your wallet (amounts, sources, labels and screenshots of the income you log) and your grade book (subjects, grades, screenshots), if they are part of your arc.",
          "Your before / after photo, if you take it: visible to you only.",
          "Payment: processed by Stripe. Nonante receives the plan, amount and subscription status, never your card.",
          "The source of your visit (utm_source and utm_campaign parameters), to know which post brought you.",
          "An encrypted fingerprint of your IP address, to limit abuse (too many attempts). The address itself is not stored.",
        ],
      },
      {
        p: "Camera rep counting happens entirely on your phone: no camera image is sent, only the number and duration of reps.",
      },
      { h2: "Legal bases" },
      {
        ul: [
          "Performance of the contract: running your account, arc, proofs and subscription.",
          "Legitimate interest: anti-cheating checks, security, internal traffic and sales statistics.",
          "Legal obligation: keeping payment records (accounting).",
          "Your choice: public profile, displayed goal or income. You can change your mind at any time.",
        ],
      },
      { h2: "Who has access" },
      {
        p: "You, and the publisher to administer the service (every view of a proof is logged). What you make public (username, player card, calendar, country, achievements, goal or income if you choose) is visible to everyone. Technical providers processing data on Nonante's behalf:",
      },
      {
        ul: [
          "Supabase: database, authentication and files.",
          "Vercel: website hosting (servers in Dublin, Ireland) and anonymous, cookie-free audience measurement: page views, country, device type, never your identity.",
          "Stripe: payment.",
          "Resend: sending emails, if enabled.",
          "Google: sign-in to your account.",
        ],
      },
      {
        p: "Transfers outside the European Union are covered by the European Commission's standard contractual clauses or by the EU–US Data Privacy Framework, depending on the provider.",
      },
      { h2: "Retention" },
      {
        ul: [
          "Proof photos and screenshots (including wallet and grade book ones): deleted 30 days after upload.",
          "Before / after photo: until you replace it or delete your account.",
          "Account, game, wallet, grade book: as long as your account exists. Delete it whenever you like, from your profile.",
          "Payments: 10 years (accounting obligation), detached from your account if it is deleted.",
        ],
      },
      { h2: "Cookies" },
      {
        p: "Nonante uses no advertising and no third-party tracking. Only necessary cookies, Nonante's own and never shared: your sign-in session; your language, if you choose it; the source of your visit, for 30 days; and, for one hour at most, your questionnaire answers while you sign in with Google. Audience measurement sets no cookie and never follows you from site to site.",
      },
      { h2: "Your rights" },
      {
        p: "You can access, correct, delete or export your data, or object to its processing. Export and account deletion are done directly from your profile; for the rest, write to {email}. You can also file a complaint with the CNIL (cnil.fr) or your local data protection authority.",
      },
    ],
  },
};
