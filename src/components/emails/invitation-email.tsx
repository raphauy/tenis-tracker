import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_STYLES } from './email-theme'

interface InvitationEmailProps {
  inviteeName?: string
  inviterName?: string
  acceptUrl?: string
  expiresInDays?: number
  appName?: string
}

export default function InvitationEmail({
  inviteeName = 'Jugador',
  inviterName = 'Raphael',
  acceptUrl = 'https://tenis-tracker.app/invitacion/token123',
  expiresInDays = 7,
  appName = 'Tenis Tracker',
}: InvitationEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        {inviterName} te invitó a {appName}: anotá tus partidos y seguí los cuadros en vivo
      </Preview>
      <Body style={EMAIL_STYLES.pageContainer}>
        <Container style={{ width: '580px', maxWidth: '100%', margin: '0 auto', padding: '16px' }}>
          <Section style={EMAIL_STYLES.cardContainer}>
            {/* Header */}
            <Section style={EMAIL_STYLES.headerSection}>
              <Container style={{ padding: '0 16px' }}>
                <Heading
                  style={{ color: EMAIL_COLORS.textWhite, margin: 0, fontSize: '20px', fontWeight: 'bold', fontFamily: EMAIL_FONTS.serif }}
                >
                  {appName}
                </Heading>
                <Text
                  style={{ color: EMAIL_COLORS.textWhite, fontSize: '14px', margin: '4px 0 0 0', opacity: 0.9 }}
                >
                  Tenés una invitación
                </Text>
              </Container>
            </Section>

            {/* Contenido principal */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', fontFamily: EMAIL_FONTS.serif }}
              >
                ¡Hola, {inviteeName}!
              </Heading>

              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 12px 0' }}
              >
                <strong style={{ color: EMAIL_COLORS.textPrimary }}>{inviterName}</strong> te
                invitó a unirte a <strong style={{ color: EMAIL_COLORS.textPrimary }}>{appName}</strong>:
                anotá tus partidos de cada torneo, mirá los cuadros de cada competencia y marcá
                a tus amigos y rivales como favoritos para seguirlos partido a partido.
              </Text>

              {/* CTA */}
              <Section style={{ textAlign: 'center', margin: '0 0 16px 0' }}>
                <Button
                  href={acceptUrl}
                  style={{
                    backgroundColor: EMAIL_COLORS.brand,
                    color: EMAIL_COLORS.textWhite,
                    borderRadius: '6px',
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Aceptar invitación
                </Button>
              </Section>

              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', lineHeight: '1.4', textAlign: 'center', margin: '0 0 12px 0' }}
              >
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:
              </Text>

              <Section
                style={{
                  backgroundColor: EMAIL_COLORS.mutedSection,
                  border: `1px solid ${EMAIL_COLORS.border}`,
                  borderRadius: '6px',
                  padding: '12px',
                  margin: '0 0 16px 0',
                }}
              >
                <Text
                  style={{
                    color: EMAIL_COLORS.brand,
                    fontSize: '12px',
                    margin: 0,
                    fontFamily: EMAIL_FONTS.mono,
                    wordBreak: 'break-all',
                  }}
                >
                  {acceptUrl}
                </Text>
              </Section>

              {/* Aviso de expiración */}
              <Section style={EMAIL_STYLES.infoAlert}>
                <Text
                  style={{ color: EMAIL_COLORS.info, fontSize: '12px', margin: 0, fontWeight: '500' }}
                >
                  Esta invitación expira en {expiresInDays} día{expiresInDays === 1 ? '' : 's'}.
                </Text>
              </Section>

              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', lineHeight: '1.4', margin: '16px 0 0 0' }}
              >
                Si no conocés a {inviterName} o no esperabas esta invitación, podés ignorar este
                email con tranquilidad.
              </Text>
            </Section>

            {/* Footer */}
            <Section style={EMAIL_STYLES.footerSection}>
              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', textAlign: 'center', margin: 0 }}
              >
                {inviterName} te envió esta invitación desde {appName}.
              </Text>
              <Text
                style={{ color: EMAIL_COLORS.textMuted, fontSize: '12px', textAlign: 'center', margin: '4px 0 0 0' }}
              >
                © {new Date().getFullYear()} {appName}. Todos los derechos reservados.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
