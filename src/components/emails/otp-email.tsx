import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { EMAIL_COLORS, EMAIL_STYLES } from './email-theme'

interface OtpEmailProps {
  otp?: string
  appName?: string
}

export default function OtpEmail({ otp = '123456', appName = 'Tenis Tracker' }: OtpEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        Tu código de verificación de {appName}: {otp}
      </Preview>
      <Body style={EMAIL_STYLES.pageContainer}>
        <Container style={{ width: '480px', maxWidth: '100%', margin: '0 auto', padding: '0 16px' }}>
          <Section style={EMAIL_STYLES.card}>
            <Section style={EMAIL_STYLES.header}>
              <Heading
                style={{ color: EMAIL_COLORS.textWhite, margin: 0, fontSize: '18px', fontWeight: 700 }}
              >
                {appName}
              </Heading>
              <Text
                style={{ color: EMAIL_COLORS.textWhite, fontSize: '13px', margin: '4px 0 0 0', opacity: 0.9 }}
              >
                Verificación de acceso
              </Text>
            </Section>

            <Section style={{ padding: '24px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}
              >
                Tu código de verificación
              </Heading>
              <Text style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 8px 0' }}>
                Ingresá este código para entrar a tu cuenta. Vence en 10 minutos.
              </Text>

              <Text style={EMAIL_STYLES.code}>{otp}</Text>

              <Text style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                Si no pediste este código, podés ignorar este correo.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
