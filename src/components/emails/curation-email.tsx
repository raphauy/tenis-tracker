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

export interface CurationEmailProps {
  venues?: number
  categories?: number
  tournaments?: number
  adminUrl?: string
  appName?: string
}

const line = (label: string, n: number) =>
  `${n} ${label}${n === 1 ? '' : 's'}`

export default function CurationEmail({
  venues = 0,
  categories = 0,
  tournaments = 0,
  adminUrl = 'https://tenis-tracker.app/admin',
  appName = 'Tenis Tracker',
}: CurationEmailProps) {
  const total = venues + categories + tournaments
  const items: string[] = []
  if (venues) items.push(line('sede', venues))
  if (categories) items.push(line('categoría', categories))
  if (tournaments) items.push(line('torneo', tournaments))

  return (
    <Html lang="es">
      <Head />
      <Preview>{`Tenés ${total} entrada${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'} de curar en ${appName}`}</Preview>
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
                  Cola de curado del catálogo
                </Text>
              </Container>
            </Section>

            {/* Contenido */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', fontFamily: EMAIL_FONTS.serif }}
              >
                Hay {total} entrada{total === 1 ? '' : 's'} para curar
              </Heading>

              <Text style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Entradas del catálogo compartido esperando aprobación o fusión:
              </Text>

              <Section style={EMAIL_STYLES.codeSection}>
                <Text
                  style={{ color: EMAIL_COLORS.textPrimary, fontSize: '15px', fontWeight: '600', margin: 0, fontFamily: EMAIL_FONTS.sans }}
                >
                  {items.join(' · ')}
                </Text>
              </Section>

              <Section style={{ textAlign: 'center', margin: '16px 0 4px 0' }}>
                <Button
                  href={adminUrl}
                  style={{
                    backgroundColor: EMAIL_COLORS.brand,
                    color: EMAIL_COLORS.textWhite,
                    fontSize: '14px',
                    fontWeight: '600',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                  }}
                >
                  Ir a curar
                </Button>
              </Section>
            </Section>

            {/* Footer */}
            <Section style={EMAIL_STYLES.footerSection}>
              <Text style={{ color: EMAIL_COLORS.textMuted, fontSize: '12px', textAlign: 'center', margin: 0 }}>
                © {new Date().getFullYear()} {appName}. Notificación diaria de curado.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
