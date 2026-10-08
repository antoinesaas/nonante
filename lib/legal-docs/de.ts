import type { LegalSet } from "@/lib/legal-docs/types";

export const de: LegalSet = {
  notice: "Diese Übersetzung dient nur der Information. Maßgeblich ist die französische Fassung; bei Abweichungen gilt sie.",

  mentions: {
    title: "Impressum",
    updated: "",
    blocks: [
      { h2: "Herausgeber" },
      { p: "Die Website und die App Nonante werden herausgegeben von {name}, {address}." },
      { p: "Kontakt: {email}" },
      { h2: "Verantwortlich für den Inhalt" },
      { p: "{name}." },
      { h2: "Hosting" },
      { p: "Website gehostet von Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA (privacy@vercel.com)." },
      {
        p: "Datenbank, Authentifizierung und Dateien gehostet von Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapur 049513 (privacy@supabase.com).",
      },
      { h2: "Geistiges Eigentum" },
      { p: "Die Marke Nonante, die Texte, das Logo und der Code der App gehören ihrem Herausgeber. Jede Vervielfältigung ohne Genehmigung ist untersagt." },
      {
        p: "Die angezeigten Bilder sind Fotografien unter CC0-Lizenz oder als „gemeinfrei“ gekennzeichnet, gemeinfreie Werke sowie einige vom Herausgeber bereitgestellte Bilder. Urheber und Quellen stehen auf der Seite [Bildnachweise](/art). Die Zitate des Tages stammen von gemeinfreien Autoren; die Übersetzungen sind von Nonante.",
      },
      { h2: "Inhalte melden" },
      { p: "Jedes öffentliche Profil hat einen Button „Melden“. Du kannst auch an {email} schreiben." },
    ],
  },

  cgu: {
    title: "Nutzungsbedingungen",
    updated: "Gültig ab 9. Oktober 2026.",
    blocks: [
      {
        p: "Diese Bedingungen regeln die Nutzung der Website und der App Nonante, herausgegeben von {name}, {address} (Kontakt: {email}). Die Zahlungsbedingungen stehen in den [Verkaufsbedingungen](/legal/cgv), die Datenverarbeitung in der [Datenschutzerklärung](/legal/confidentialite).",
      },
      { h2: "1. Der Dienst" },
      {
        p: "Nonante begleitet einen Arc von 90 Tagen: ein Ziel, persönliche „Wenn… dann…“-Prinzipien, tägliche Nachweise, Spielerwerte, eine Rangliste, Squads und je nach Arc ein Einnahmen-Portemonnaie oder ein Notenheft. Fragebogen und Planseite sind ohne Konto zugänglich; alles Weitere erfordert ein Konto und einen bezahlten Plan.",
      },
      { h2: "2. Zugang und Konto" },
      {
        ul: [
          "Nonante ist nur für Volljährige (ab 18 Jahren).",
          "Das Konto wird mit einem Google-Konto erstellt, ohne eigenes Nonante-Passwort. Du bist für den Zugang zu deinem Google-Konto verantwortlich.",
          "Ein Konto pro Person. Wegwerf-E-Mail-Adressen werden nicht akzeptiert.",
          "Dein Benutzername und dein Profilfoto dürfen niemanden imitieren und nicht beleidigend, diskriminierend, sexuell oder rechtswidrig sein.",
        ],
      },
      { h2: "3. Die Spielregeln" },
      {
        p: "Die Regeln (Punkte, Nachweise, Joker, Quests, Level, Rangliste, gehaltener oder abgebrochener Arc) sind in der App und in den [häufigen Fragen](/faq) beschrieben. Sie werden vom Server nach Pariser Zeit für alle gleich angewendet. Nonante kann sie anpassen, um ein Ungleichgewicht oder eine Lücke zu beheben; eine Änderung nimmt nie ehrlich verdiente Punkte weg.",
      },
      { h2: "4. Nachweise" },
      {
        ul: [
          "Ein Nachweis muss dem entsprechen, was du am selben Tag wirklich getan hast.",
          "Ein Teil der schwachen Nachweise wird zufällig kontrolliert. Ein abgelehnter Nachweis führt zu den in den Regeln vorgesehenen Strafen und bleibt auf deinem Profil gezählt.",
          "Verboten: Timer, Kamera oder Weckcode umgehen, den Nachweis einer anderen Person wiederverwenden, Validierungen automatisieren, eine Lücke ausnutzen statt sie zu melden.",
          "Wer den Timer-Bildschirm verlässt (länger als 10 Sekunden, zurück, schließen), bricht die Session ab, mit der vorgesehenen Strafe.",
          "Das Zählen per Kamera geschieht auf deinem Gerät, kein Bild wird gesendet. Die Fotos, die du als Nachweis sendest, sind privat und werden nach 30 Tagen gelöscht.",
        ],
      },
      { h2: "5. Deine Inhalte" },
      {
        p: "Du bleibst Eigentümer dessen, was du veröffentlichst (Profilfoto, Bio, Nachweise, Links, Noten). Du erlaubst Nonante, diese zu speichern, gemäß deinen Einstellungen (öffentlich oder privat) anzuzeigen und zu kontrollieren, nur zum Betrieb des Dienstes und so lange wie nötig. Veröffentliche nur Inhalte, an denen du die Rechte hast, und kein Foto einer anderen Person ohne deren Zustimmung.",
      },
      { h2: "6. Öffentliche Profile, Rangliste und Squads" },
      {
        ul: [
          "Ist dein Profil öffentlich, sind dein Benutzername, dein Foto, deine Spielerkarte, dein Kalender, dein Land und deine Erfolge für alle sichtbar; dein Ziel und dein Portemonnaie nur, wenn du es willst. Privat erscheinst du als „Anonym“.",
          "Rangliste, Level und Erfolge berechtigen zu keinem Geldgewinn und keinem Preis. Das Portemonnaie ist eine persönliche Übersicht: Nonante zahlt, verwahrt und überweist kein Geld.",
          "Jedes Profil kann gemeldet werden. Nach Prüfung kann ein Profil ausgeblendet und ein Konto bei Verstoß gegen diese Bedingungen gesperrt oder geschlossen werden. Du kannst eine Entscheidung anfechten, indem du an {email} schreibst.",
        ],
      },
      { h2: "7. Gesundheit und Ratschläge" },
      {
        p: "Sport- (Liegestütze, Kniebeugen, Laufen…) und Schlafprinzipien übst du auf eigene Verantwortung und gemäß deiner körperlichen Verfassung aus; frage im Zweifel einen Arzt. Business-, Trading- und Lernprinzipien sind Organisationsmethoden, keine Finanz-, Anlage-, Rechts- oder medizinische Beratung. Nonante garantiert nicht, dass du dein Ziel erreichst: Du bist es, der es hält.",
      },
      { h2: "8. Verfügbarkeit" },
      {
        p: "Nonante tut sein Bestes, damit der Dienst verfügbar und sicher ist. Unterbrechungen können wegen Wartung oder bei Ausfall eines Anbieters auftreten; hindert dich ein Ausfall daran, einen Nachweis zu erbringen, schreib an {email}: Der Tag kann nach Prüfung korrigiert werden.",
      },
      { h2: "9. Geistiges Eigentum" },
      {
        p: "Die Marke Nonante, das Logo, die Texte, die Spielregeln und der Code der App sind geschützt. Die Bilder stammen aus lizenzfreien oder gemeinfreien Quellen oder vom Herausgeber und sind auf der Seite [Bildnachweise](/art) genannt.",
      },
      { h2: "10. Ende des Kontos" },
      {
        p: "Du kannst deine Daten jederzeit in deinem Profil exportieren und dein Konto löschen. Die Löschung entfernt dein Profil, deine Prinzipien, Nachweise, Noten, Punkte und Fotos; Zahlungsbelege werden, von deinem Konto getrennt, für die Buchhaltungspflichten aufbewahrt.",
      },
      { h2: "11. Änderungen" },
      {
        p: "Diese Bedingungen können sich ändern. Wichtige Änderungen werden dir mindestens 15 Tage vor Inkrafttreten in der App angekündigt; wenn du nicht einverstanden bist, kannst du dein Konto löschen.",
      },
      { h2: "12. Anwendbares Recht" },
      {
        p: "Diese Bedingungen unterliegen französischem Recht. Bei Meinungsverschiedenheiten schreib zuerst an {email}, um eine gütliche Lösung zu finden; es gelten die in den Verkaufsbedingungen vorgesehenen Rechtsbehelfe.",
      },
    ],
  },

  cgv: {
    title: "Verkaufsbedingungen",
    updated: "Gültig ab 8. Oktober 2026.",
    blocks: [
      { h2: "1. Verkäufer" },
      { p: "{name}, {address}. Kontakt: {email}." },
      { h2: "2. Der Dienst" },
      {
        p: "Nonante ist eine Web-App, die einen Arc von 90 Tagen begleitet: ein Ziel, persönliche „Wenn… dann…“-Prinzipien, tägliche Nachweise (Timer, Zählen der Wiederholungen per Kamera, Weckcode, Foto, Screenshot, Link), Werte, eine Rangliste und Squads. Der Dienst ist im Browser auf Handy oder Computer nutzbar.",
      },
      { h2: "3. Pläne und Preise" },
      {
        ul: [
          "90-Tage-Arc: 19,99 € als Einmalzahlung für einen Arc von 90 Tagen (ab dem gewählten Tag 1). Kein Abo: Danach wird nichts mehr abgebucht. Jeder neue Arc wird beim Start bezahlt. Das Portemonnaie ist in Business-Arcs enthalten, das Notenheft in Studien-Arcs.",
          "Pro: Abo zu 14,99 € pro Monat oder 99,99 € pro Jahr, das alle Arcs abdeckt, solange es aktiv ist.",
          "Gründer: 199 € als Einmalzahlung, unbefristeter Zugang zum Pro-Plan, begrenzt auf 100 Plätze.",
        ],
      },
      {
        p: "Die Preise verstehen sich in Euro inklusive aller Steuern. Der Inhalt jedes Plans ist zum Zeitpunkt der Bestellung auf der Seite Pläne beschrieben. Eine Preisänderung gilt nie für einen bereits bezahlten Arc oder Zeitraum; bei einem laufenden Abo wird sie mindestens 30 Tage vorher angekündigt, und du kannst vorher kündigen.",
      },
      {
        p: "Der 90-Tage-Arc deckt den Arc ab, für den er bezahlt wurde, bis zu seinem 90. Tag oder bis er nach den Spielregeln abgebrochen ist (7 leere Tage in Folge). Wird er ohne Arc im Aufbau bezahlt, wird er als Guthaben für deinen nächsten Arc aufbewahrt.",
      },
      { h2: "4. Bestellung und Zahlung" },
      {
        p: "Die Zahlung wird von Stripe abgewickelt. Nonante hat nie Zugriff auf deine Kartennummern. Das monatliche oder jährliche Pro-Abo verlängert sich am Ende jedes Zeitraums automatisch zum geltenden Preis, bis es gekündigt wird. Der 90-Tage-Arc und der Gründer-Plan verlängern sich nie. Für jede Zahlung steht eine Rechnung in deinem Zahlungsbereich bereit (Profil, dann „Meine Rechnungen“ oder „Abo verwalten“).",
      },
      { h2: "5. Kündigung des Pro-Abos" },
      {
        p: "Du kannst Pro jederzeit mit einem Klick in deinem Profil kündigen. Die Kündigung wird zum Ende des bereits bezahlten Zeitraums wirksam: Dein Zugang bleibt bis dahin offen, und es wird nichts mehr abgebucht. Angebrochene Zeiträume werden nicht erstattet, außer bei Ausübung des Widerrufsrechts (Abschnitt 6).",
      },
      { p: "Ohne aktives Abo läuft dein Arc weiter, aber kein Nachweis kann mehr bestätigt werden: Die Tage werden nach den Spielregeln leer." },
      { h2: "6. Widerrufsrecht" },
      {
        p: "Du hast ab deinem Kauf (90-Tage-Arc, Pro oder Gründer) 14 Tage Zeit, ohne Angabe von Gründen zu widerrufen (Artikel L221-18 ff. des französischen Verbrauchergesetzbuchs). Bei der Zahlung verlangst du ausdrücklich, dass der Dienst sofort beginnt. Widerrufst du innerhalb dieser 14 Tage, zahlst du nur den bis zu deinem Widerruf bereits erbrachten Teil des Dienstes anteilig (Artikel L221-25), und der Rest wird dir innerhalb von 14 Tagen über dasselbe Zahlungsmittel erstattet.",
      },
      { p: "Um zu widerrufen, sende eine eindeutige Erklärung an {email}, zum Beispiel mit dem Muster unten." },
      {
        quote:
          "An {name}, {address}, {email}: Hiermit widerrufe ich den Vertrag über den folgenden Nonante-Dienst. Plan: … Gekauft am: … Name und E-Mail-Adresse des Kontos: … Datum: …",
      },
      { h2: "7. Rabatte" },
      {
        ul: [
          "Empfehlung: Der Link oder Code eines Spielers gibt −20 % auf die erste Zahlung eines neuen Spielers; der Werber erhält seinerseits −20 % auf seinen nächsten 90-Tage-Arc oder auf seine nächste Pro-Rechnung, wenn er abonniert ist. Ein Rabatt pro Geworbenem, nur ein Rabatt pro Zahlung.",
          "Treue: Ein gehaltener Arc gibt −50 % auf den nächsten 90-Tage-Arc oder auf die nächste Pro-Rechnung, einmal pro Arc.",
        ],
      },
      { p: "Diese Rabatte sind für alle gleich, haben keinen Geldwert und sind nie an die Rangliste gebunden." },
      { h2: "8. Rangliste und Spiel" },
      {
        p: "Rangliste, Level und Erfolge bringen nur Punkte, Titel und Hintergründe für die Spielerkarte. Es werden kein Geld und keine Preise vergeben. Das Portemonnaie ist eine persönliche Übersicht dessen, was du mit deinem eigenen Projekt verdienst: Nonante zahlt und verwahrt kein Geld.",
      },
      { h2: "9. Verhaltensregeln" },
      {
        p: "Nachweise müssen echt sein. Ein bei einer Kontrolle abgelehnter Nachweis führt zu den in den Regeln vorgesehenen Strafen. Betrügerisches Verhalten, ein beleidigender Benutzername oder ein beleidigendes Profilfoto können zum Ausblenden des Profils oder zur Schließung des Kontos führen.",
      },
      { h2: "10. Gesundheit" },
      {
        p: "Sportprinzipien (Liegestütze, Kniebeugen, Laufen…) übst du auf eigene Verantwortung und gemäß deiner körperlichen Verfassung aus. Frage im Zweifel einen Arzt. Nonante gibt keine medizinischen Ratschläge.",
      },
      { h2: "11. Haftung" },
      {
        p: "Nonante verpflichtet sich, den Dienst sorgfältig zu erbringen und so gut wie möglich verfügbar zu halten. Gelegentliche Unterbrechungen für Wartung sind möglich. Die Haftung des Herausgebers ist auf direkte, nachgewiesene Schäden begrenzt, bis zur Höhe der in den letzten 12 Monaten gezahlten Beträge.",
      },
      { h2: "12. Personenbezogene Daten" },
      { p: "Die Verarbeitung deiner Daten ist in der [Datenschutzerklärung](/legal/confidentialite) beschrieben." },
      { h2: "13. Streitigkeiten" },
      {
        p: "Diese Bedingungen unterliegen französischem Recht. Bei Schwierigkeiten schreib zuerst an {email}: Wir suchen eine gütliche Lösung. Du kannst auch kostenlos einen Verbraucherschlichter anrufen (Artikel L611-1 ff. des französischen Verbrauchergesetzbuchs); seine Kontaktdaten erhältst du auf Anfrage. Kommt keine Einigung zustande, sind die französischen Gerichte zuständig.",
      },
    ],
  },

  privacy: {
    title: "Datenschutz",
    updated: "Gültig ab 9. Oktober 2026.",
    blocks: [
      { h2: "Verantwortlicher" },
      { p: "{name}, {address}. Für Fragen zu deinen Daten: {email}." },
      { h2: "Was erhoben wird, und warum" },
      {
        ul: [
          "Deine E-Mail-Adresse: um dich anzumelden und dir Nachrichten zum Dienst zu senden. Die Anmeldung läuft über Google: Nonante erhält die E-Mail-Adresse, den Namen und das Profilbild deines Google-Kontos, sonst nichts.",
          "Dein Benutzername, dein Geburtsjahr (um zu prüfen, dass du 18 bist), dein Profilfoto und deine Bio, wenn du sie hinzufügst.",
          "Deine Sprache und dein Land (aus deiner Verbindung abgeleitet, nur auf Länderebene): um die App in deiner Sprache und die Rangliste nach Land anzuzeigen.",
          "Deine Antworten im Fragebogen (Profil, Tätigkeit, Schule, Ziel, Schwachpunkte, Rhythmus, Sport, Tag 1): Sie bauen deinen Arc. Gibst du sie vor der Kontoerstellung ein, werden sie mit deiner E-Mail höchstens 3 Tage aufbewahrt, bis du dich anmeldest, und dann gelöscht.",
          "Dein Ziel, deine Prinzipien, Bestätigungen, Sessions, Punkte und Werte: Das ist das Spiel.",
          "Deine Nachweise: in der App aufgenommene Fotos, Screenshots, Links. Sie dienen den Kontrollen und bleiben privat.",
          "Dein Portemonnaie (Beträge, Quellen, Bezeichnungen und Screenshots der erfassten Einnahmen) und dein Notenheft (Fächer, Noten, Screenshots), wenn sie zu deinem Arc gehören.",
          "Dein Vorher-/Nachher-Foto, wenn du es aufnimmst: nur für dich sichtbar.",
          "Die Zahlung: von Stripe abgewickelt. Nonante erhält Plan, Betrag und Abostatus, nie deine Karte.",
          "Die Quelle deines Besuchs (Parameter utm_source und utm_campaign), um zu wissen, welcher Beitrag dich gebracht hat.",
          "Ein verschlüsselter Fingerabdruck deiner IP-Adresse, um Missbrauch zu begrenzen (zu viele Versuche). Die Adresse selbst wird nicht gespeichert.",
          "Die technische Adresse deines Browsers, wenn du Benachrichtigungen aktivierst.",
        ],
      },
      {
        p: "Das Zählen der Wiederholungen per Kamera geschieht vollständig auf deinem Handy: Kein Kamerabild wird gesendet, nur Anzahl und Dauer der Wiederholungen.",
      },
      { h2: "Rechtsgrundlagen" },
      {
        ul: [
          "Vertragserfüllung: Betrieb deines Kontos, deines Arcs, deiner Nachweise und deines Abos.",
          "Berechtigtes Interesse: Anti-Betrugs-Kontrollen, Sicherheit, interne Besuchs- und Verkaufsstatistiken.",
          "Rechtliche Verpflichtung: Aufbewahrung der Zahlungsbelege (Buchhaltung).",
          "Deine Wahl: öffentliches Profil, angezeigtes Ziel oder Einnahmen, Benachrichtigungen. Du kannst deine Meinung jederzeit ändern.",
        ],
      },
      { h2: "Wer Zugriff hat" },
      {
        p: "Du und der Herausgeber zur Verwaltung des Dienstes (jede Einsicht in einen Nachweis wird protokolliert). Was du öffentlich machst (Benutzername, Spielerkarte, Kalender, Land, Erfolge, Ziel oder Einnahmen, wenn du willst), ist für alle sichtbar. Technische Dienstleister, die Daten im Auftrag von Nonante verarbeiten:",
      },
      {
        ul: [
          "Supabase: Datenbank, Authentifizierung und Dateien.",
          "Vercel: Hosting der Website (USA).",
          "Stripe: Zahlung.",
          "Resend: E-Mail-Versand, falls aktiviert.",
          "Google: Anmeldung mit deinem Konto.",
          "Die Benachrichtigungsdienste deines Browsers (Apple, Google, Mozilla, Microsoft), wenn du Benachrichtigungen aktivierst.",
        ],
      },
      {
        p: "Übermittlungen außerhalb der Europäischen Union erfolgen auf Grundlage der Standardvertragsklauseln der Europäischen Kommission oder des EU-US-Datenschutzrahmens, je nach Dienstleister.",
      },
      { h2: "Speicherdauer" },
      {
        ul: [
          "Nachweisfotos und Screenshots (auch die des Portemonnaies und des Notenhefts): 30 Tage nach dem Hochladen gelöscht.",
          "Vorher-/Nachher-Foto: bis du es ersetzt oder dein Konto löschst.",
          "Konto, Spiel, Portemonnaie, Notenheft: solange dein Konto besteht. Lösche es jederzeit in deinem Profil.",
          "Zahlungen: 10 Jahre (Buchhaltungspflicht), von deinem Konto getrennt, falls es gelöscht wird.",
        ],
      },
      { h2: "Cookies" },
      {
        p: "Nonante nutzt weder Werbung noch Tracking durch Dritte. Nur notwendige Cookies von Nonante, die nie geteilt werden: deine Anmeldesitzung; deine Sprache, wenn du sie wählst; die Quelle deines Besuchs, 30 Tage lang; und höchstens eine Stunde lang deine Antworten im Fragebogen während deiner Anmeldung mit Google.",
      },
      { h2: "Deine Rechte" },
      {
        p: "Du kannst auf deine Daten zugreifen, sie berichtigen, löschen, exportieren oder ihrer Verarbeitung widersprechen. Export und Kontolöschung erfolgen direkt in deinem Profil; für alles andere schreib an {email}. Du kannst auch Beschwerde bei der CNIL (cnil.fr) oder bei deiner Datenschutzbehörde einlegen.",
      },
    ],
  },
};
