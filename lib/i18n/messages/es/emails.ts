import type { emails as fr } from "@/lib/i18n/messages/fr/emails";

export const emails: typeof fr = {
  signature: "Nonante",
  welcome: {
    subject: "Tu arco está en marcha.",
    body: "Tu pago está confirmado. Tu arco de 90 días está en marcha.\n\nTus principios te esperan. Nada cuenta sin prueba.",
  },
  audit: {
    subject: "Control: envía tu prueba.",
    labelled: "Tu validación «{label}» está en control.",
    generic: "Una de tus validaciones está en control.",
    body: "Envía una foto de tu prueba antes de {due}. Sin respuesta, la penalización es fuerte.",
  },
  loyalty: {
    subject: "Arco cumplido.",
    body: "Has cumplido tu arco. 90 días, probados.",
    applied: "Gracias: tu próxima factura tiene −50 %. No tienes que hacer nada, el descuento ya está aplicado.",
    pending: "Gracias: tu próximo Arco 90 días tiene −50 %. El descuento se aplica solo al pagar.",
  },
  result: {
    subject: "Tu arco ha terminado.",
    body: "Tu arco ha terminado: {green|# día verde|# días verdes} de 90.\nHacían falta 75, sin más de 3 días no verdes seguidos.\n\nEl próximo arco empieza cuando quieras.",
  },
  referral: {
    subject: "Alguien se ha unido a Nonante gracias a ti.",
    body: "Tu código de referido se ha usado: tu amigo ha lanzado su arco con −20 %.",
    subscription: "Tú también: −20 % en tu próxima factura Pro, ya aplicado.",
    nextArc: "Tú también: −20 % en tu próximo Arco 90 días. El descuento se aplica solo al pagar.",
  },
};
