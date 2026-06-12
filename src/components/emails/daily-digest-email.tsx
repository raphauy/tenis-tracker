import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_STYLES } from './email-theme'
import { bracketPath, notificationSummary, type NotificationView } from '@/lib/notifications/copy'
import { shortCategoryLabel } from '@/lib/cuadros/category-label'

export interface DailyDigestEmailProps {
  items?: NotificationView[]
  appUrl?: string
  settingsUrl?: string
  appName?: string
}

const SAMPLE: NotificationView[] = [
  {
    playerName: 'Ana Pérez',
    outcome: 'WON',
    tournamentName: 'AUT Grados febrero 2026',
    categoryName: '5ta',
    roundLabel: 'Cuartos',
    nextRoundLabel: 'Semifinal',
    opponentName: 'Bárbara López',
    score: '6-4 6-3',
    isWalkover: false,
    tournamentSlug: 'aut-grados-febrero-2026',
    categorySlug: '5ta',
  },
  {
    playerName: 'Carlos Díaz',
    outcome: 'WON',
    tournamentName: 'Torneo La Academia MG 2026',
    categoryName: 'B',
    roundLabel: '16avos',
    nextRoundLabel: 'Octavos',
    opponentName: 'Diego Souza',
    score: null,
    isWalkover: true,
    tournamentSlug: 'academia-mg-2026',
    categorySlug: 'b',
  },
  {
    playerName: 'Eugenia Mora',
    outcome: 'CHAMPION',
    tournamentName: 'Torneo La Academia MG 2026',
    categoryName: 'B',
    roundLabel: 'Final',
    nextRoundLabel: null,
    opponentName: 'Florencia Rey',
    score: '7-5 6-4',
    isWalkover: false,
    tournamentSlug: 'academia-mg-2026',
    categorySlug: 'b',
  },
]

// Resumen diario: todos los resultados pendientes del día. Si no hay items, el service no lo
// envía (no se renderiza un email vacío).
export default function DailyDigestEmail({
  items = SAMPLE,
  appUrl = 'https://tenis-tracker.app',
  settingsUrl = 'https://tenis-tracker.app',
  appName = 'Tenis Tracker',
}: DailyDigestEmailProps) {
  const count = items.length
  return (
    <Html lang="es">
      <Head />
      <Preview>{`${count} resultado${count === 1 ? '' : 's'} de tus favoritos`}</Preview>
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
                  Resumen de resultados de tus favoritos
                </Text>
              </Container>
            </Section>

            {/* Lista */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              {items.map((n, i) => (
                <Section key={i} style={{ margin: '0 0 4px 0' }}>
                  <Text style={{ color: EMAIL_COLORS.textPrimary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 2px 0' }}>
                    {notificationSummary(n)}
                  </Text>
                  <Text style={{ color: EMAIL_COLORS.textMuted, fontSize: '12px', margin: 0 }}>
                    {n.tournamentName} · Categoría {shortCategoryLabel(n.categoryName)} ·{' '}
                    <Link href={`${appUrl}${bracketPath(n)}`} style={{ color: EMAIL_COLORS.info, textDecoration: 'underline' }}>
                      Ver el cuadro
                    </Link>
                  </Text>
                  {i < items.length - 1 ? (
                    <Hr style={{ borderColor: EMAIL_COLORS.border, margin: '10px 0' }} />
                  ) : null}
                </Section>
              ))}
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
