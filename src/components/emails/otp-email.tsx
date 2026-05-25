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
import { EMAIL_COLORS, EMAIL_FONTS, EMAIL_STYLES } from './email-theme'

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
                  Verificación de Acceso Seguro
                </Text>
              </Container>
            </Section>

            {/* Contenido principal */}
            <Section style={{ padding: '8px 16px 12px 16px' }}>
              <Heading
                style={{ color: EMAIL_COLORS.textPrimary, fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', fontFamily: EMAIL_FONTS.serif }}
              >
                Tu código de verificación
              </Heading>

              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '14px', lineHeight: '1.5', margin: '0 0 16px 0' }}
              >
                Usá el siguiente código de verificación para completar tu inicio de sesión. Este
                código expirará en 10 minutos.
              </Text>

              {/* Caja del código OTP */}
              <Section style={{ textAlign: 'center', margin: '0 0 16px 0' }}>
                <div style={EMAIL_STYLES.codeSection}>
                  <Text
                    style={{
                      color: EMAIL_COLORS.textPrimary,
                      fontSize: '24px',
                      fontWeight: 'bold',
                      letterSpacing: '0.5em',
                      margin: 0,
                      fontFamily: EMAIL_FONTS.mono,
                    }}
                  >
                    {otp}
                  </Text>
                </div>
              </Section>

              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', lineHeight: '1.4', margin: '0 0 12px 0' }}
              >
                Por tu seguridad, no compartas este código con nadie. Si no solicitaste este código
                de verificación, ignorá este email.
              </Text>

              {/* Aviso de seguridad */}
              <Section style={EMAIL_STYLES.infoAlert}>
                <Text
                  style={{ color: EMAIL_COLORS.info, fontSize: '12px', margin: 0, fontWeight: '500' }}
                >
                  🔒 Tip de seguridad: Nunca te pediremos tu código de verificación por teléfono,
                  email u otro método.
                </Text>
              </Section>
            </Section>

            {/* Footer */}
            <Section style={EMAIL_STYLES.footerSection}>
              <Text
                style={{ color: EMAIL_COLORS.textSecondary, fontSize: '12px', textAlign: 'center', margin: 0 }}
              >
                Este email fue enviado como parte de la seguridad de tu cuenta de {appName}.
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
