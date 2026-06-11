// Cookie que arrastra el token de invitación desde /invitacion/[token] hasta el
// onboarding: como el registro es por WhatsApp (no por email), es la única forma
// de vincular la invitación con la cuenta que termina creándose.
export const INVITE_COOKIE = 'invite_token'
