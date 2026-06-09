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

export interface SyncAlertEmailProps {
  source?: string
  error?: string
  adminUrl?: string
  appName?: string
}

export default function SyncAlertEmail({
  source = 'fuente',
  error = '',
  adminUrl = 'https://tenis-tracker.app/admin/cuadros',
  appName = 'Tenis Tracker',
}: SyncAlertEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{`Falló la sincronización de cuadros (${source}) en ${appName}`}</Preview>
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
                  Alerta de sincronización de cuadros
                </Text>
              </Container>
            </Section>

            {/* Contenido */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', fontFamily: EMAIL_FONTS.serif }}
              >
                Falló el sync de la fuente «{source}»
              </Heading>

              <Text style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                La sincronización de cuadros no pudo leer esta fuente. Los cuadros existentes se
                siguen mostrando con su último dato bueno y no se archivó nada. Revisá la fuente y
                reintentá desde el panel.
              </Text>

              <Section style={EMAIL_STYLES.codeSection}>
                <Text
                  style={{ color: EMAIL_COLORS.textPrimary, fontSize: '13px', fontWeight: '600', margin: 0, fontFamily: EMAIL_FONTS.mono, wordBreak: 'break-word' }}
                >
                  {error || 'Error desconocido'}
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
                  Ver estado en el panel
                </Button>
              </Section>
            </Section>

            {/* Footer */}
            <Section style={EMAIL_STYLES.footerSection}>
              <Text style={{ color: EMAIL_COLORS.textMuted, fontSize: '12px', textAlign: 'center', margin: 0 }}>
                © {new Date().getFullYear()} {appName}. Alerta automática de sincronización.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
