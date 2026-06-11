import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_STYLES } from './email-theme'
import {
  bracketPath,
  notificationSummary,
  notificationTitle,
  type NotificationView,
} from '@/lib/notifications/copy'

export interface ResultNotificationEmailProps {
  notification?: NotificationView
  appUrl?: string
  settingsUrl?: string
  appName?: string
}

const SAMPLE: NotificationView = {
  playerName: 'Ana Pérez',
  outcome: 'WON',
  tournamentName: 'AUT Grados febrero 2026',
  categoryName: '5ta',
  roundLabel: 'Cuartos',
  nextRoundLabel: 'Semifinal',
  opponentName: 'Bárbara López',
  score: '6-4 6-3',
  tournamentSlug: 'aut-grados-febrero-2026',
  categorySlug: '5ta',
}

// Email inmediato: un resultado nuevo de un favorito. Patrón en docs/dev y sync-alert-email.
export default function ResultNotificationEmail({
  notification = SAMPLE,
  appUrl = 'https://tenis-tracker.app',
  settingsUrl = 'https://tenis-tracker.app',
  appName = 'Tenis Tracker',
}: ResultNotificationEmailProps) {
  const bracketUrl = `${appUrl}${bracketPath(notification)}`
  return (
    <Html lang="es">
      <Head />
      <Preview>{notificationTitle(notification)}</Preview>
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
                <Text style={{ color: EMAIL_COLORS.textWhite, fontSize: '14px', margin: '4px 0 0 0', opacity: 0.9 }}>
                  Resultado de un favorito
                </Text>
              </Container>
            </Section>

            {/* Contenido */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', fontFamily: EMAIL_FONTS.serif }}
              >
                {notificationTitle(notification)}
              </Heading>

              <Text style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                {notificationSummary(notification)}
              </Text>

              <Section style={EMAIL_STYLES.codeSection}>
                <Text style={{ color: EMAIL_COLORS.textPrimary, fontSize: '13px', fontWeight: '600', margin: 0, fontFamily: EMAIL_FONTS.sans }}>
                  {notification.tournamentName} · {notification.categoryName}
                </Text>
              </Section>

              <Section style={{ textAlign: 'center', margin: '16px 0 4px 0' }}>
                <Button
                  href={bracketUrl}
                  style={{ backgroundColor: EMAIL_COLORS.brand, color: EMAIL_COLORS.textWhite, fontSize: '14px', fontWeight: '600', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none' }}
                >
                  Ver el cuadro
                </Button>
              </Section>
            </Section>

            {/* Footer educativo */}
            <Section style={EMAIL_STYLES.footerSection}>
              <Text style={{ color: EMAIL_COLORS.textMuted, fontSize: '12px', textAlign: 'center', margin: 0 }}>
                <Link href={settingsUrl} style={{ color: EMAIL_COLORS.info, textDecoration: 'underline' }}>
                  Configurá tus notificaciones
                </Link>
                {' '}— también te las podemos mandar por WhatsApp.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
