package utils

import (
	"fmt"
	"log"
	"os"

	"github.com/resend/resend-go/v2"
)

// SendVerificationEmail sends an email verification link to the user
func SendVerificationEmail(recipientEmail, verificationToken string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	fromName := os.Getenv("RESEND_FROM_NAME")

	// Fallback to dev mode if no API key configured
	if apiKey == "" {
		// Log without exposing token (security)
		log.Printf("[DEV MODE] Email verification requested for %s (token sent to email)", recipientEmail)
		return nil
	}

	// Default sender name if not configured
	if fromName == "" {
		fromName = "AIValid"
	}

	// Default sender email if not configured
	if fromEmail == "" {
		fromEmail = "onboarding@resend.dev" // Resend's test email
	}

	// Format sender with display name: "Display Name <email@domain.com>"
	formattedFrom := fmt.Sprintf("%s <%s>", fromName, fromEmail)

	// Build verification link
	frontend := os.Getenv("FRONTEND_BASE_URL")
	if frontend == "" {
		frontend = "http://localhost:3000"
	}
	verificationLink := frontend + "/verify-email?token=" + verificationToken

	// Build HTML email template
	htmlBody := buildVerificationEmailHTML(verificationLink)

	// Create Resend client
	client := resend.NewClient(apiKey)

	// Send email with proper sender name and reply-to
	params := &resend.SendEmailRequest{
		From:    formattedFrom,
		To:      []string{recipientEmail},
		ReplyTo: fromEmail, // Allow replies to the sender email
		Subject: "Verifikasi Email Anda",
		Html:    htmlBody,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Printf("Failed to send verification email to %s: %v", recipientEmail, err)
		return fmt.Errorf("gagal mengirim email verifikasi")
	}

	log.Printf("Verification email sent to %s (ID: %s, From: %s)", recipientEmail, sent.Id, formattedFrom)
	return nil
}

// buildVerificationEmailHTML creates a branded HTML template for verification email
func buildVerificationEmailHTML(verificationLink string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'IBM Plex Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; -webkit-font-smoothing: antialiased;">
    <table role="presentation" style="width: 100%%; border-collapse: collapse; background-color: #f4f5f7;">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" style="width: 520px; max-width: 100%%; border-collapse: collapse;">
                    <!-- Brand Header -->
                    <tr>
                        <td align="center" style="padding: 0 0 32px;">
                            <span style="font-size: 22px; font-weight: 700; color: #4338ca; letter-spacing: -0.02em;">AIValid</span>
                        </td>
                    </tr>

                    <!-- Card -->
                    <tr>
                        <td style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e5ea; overflow: hidden;">
                            <!-- Indigo accent top border -->
                            <div style="height: 3px; background: linear-gradient(90deg, #4338ca 0%%, #6366f1 50%%, #818cf8 100%%);"></div>

                            <!-- Content -->
                            <table role="presentation" style="width: 100%%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 40px 36px 12px;">
                                        <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
                                            Verifikasi Email Anda
                                        </h1>
                                        <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                                            Selesaikan pendaftaran dengan mengklik tombol di bawah.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 20px 36px 32px;">
                                        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #374151;">
                                            Terima kasih telah mendaftar di AIValid! Untuk mengaktifkan akun Anda, silakan verifikasi alamat email dengan mengklik tombol berikut:
                                        </p>

                                        <!-- CTA Button -->
                                        <table role="presentation" style="margin: 0 0 24px; width: 100%%;">
                                            <tr>
                                                <td align="center">
                                                    <a href="%s" style="display: inline-block; padding: 13px 36px; background-color: #4338ca; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; line-height: 1; letter-spacing: 0.01em;">
                                                        Verifikasi Email
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                            Link verifikasi ini berlaku selama <strong style="color: #374151;">24 jam</strong>.
                                        </p>
                                        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                            Jika Anda tidak membuat akun ini, abaikan email ini.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Fallback Link -->
                                <tr>
                                    <td style="padding: 0 36px 36px;">
                                        <table role="presentation" style="width: 100%%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
                                                    <p style="margin: 0 0 6px; font-size: 12px; font-weight: 500; color: #6b7280;">
                                                        Tombol tidak bekerja? Salin link ini ke browser:
                                                    </p>
                                                    <p style="margin: 0; font-size: 12px; word-break: break-all; line-height: 1.5;">
                                                        <a href="%s" style="color: #4338ca; text-decoration: underline;">%s</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 28px 16px 0; text-align: center;">
                            <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                                © 2026 AIValid · Platform validasi hasil kerja AI
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #b0b5bf; line-height: 1.5;">
                                Email otomatis — mohon jangan membalas email ini.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, verificationLink, verificationLink, verificationLink)
}

// SendPasswordResetEmail sends password reset email
func SendPasswordResetEmail(recipientEmail, resetToken string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	fromName := os.Getenv("RESEND_FROM_NAME")

	frontend := os.Getenv("FRONTEND_BASE_URL")
	if frontend == "" {
		frontend = "http://localhost:3000"
	}
	resetLink := frontend + "/reset-password?token=" + resetToken

	// Fallback to dev mode if no API key configured
	if apiKey == "" {
		// Log without exposing token (security)
		log.Printf("[DEV MODE] Password reset requested for %s (token sent to email)", recipientEmail)
		return nil
	}

	// Default sender name if not configured
	if fromName == "" {
		fromName = "AIValid"
	}

	if fromEmail == "" {
		fromEmail = "onboarding@resend.dev"
	}

	// Format sender with display name
	formattedFrom := fmt.Sprintf("%s <%s>", fromName, fromEmail)

	htmlBody := buildPasswordResetEmailHTML(resetLink)

	client := resend.NewClient(apiKey)
	params := &resend.SendEmailRequest{
		From:    formattedFrom,
		To:      []string{recipientEmail},
		ReplyTo: fromEmail,
		Subject: "Reset Password - AIValid",
		Html:    htmlBody,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Printf("Failed to send password reset email to %s: %v", recipientEmail, err)
		return fmt.Errorf("gagal mengirim email reset password")
	}

	log.Printf("Password reset email sent to %s (ID: %s, From: %s)", recipientEmail, sent.Id, formattedFrom)
	return nil
}

// buildPasswordResetEmailHTML creates a branded HTML template for password reset email
func buildPasswordResetEmailHTML(resetLink string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'IBM Plex Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; -webkit-font-smoothing: antialiased;">
    <table role="presentation" style="width: 100%%; border-collapse: collapse; background-color: #f4f5f7;">
        <tr>
            <td align="center" style="padding: 40px 16px;">
                <table role="presentation" style="width: 520px; max-width: 100%%; border-collapse: collapse;">
                    <!-- Brand Header -->
                    <tr>
                        <td align="center" style="padding: 0 0 32px;">
                            <span style="font-size: 22px; font-weight: 700; color: #4338ca; letter-spacing: -0.02em;">AIValid</span>
                        </td>
                    </tr>

                    <!-- Card -->
                    <tr>
                        <td style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e5ea; overflow: hidden;">
                            <!-- Indigo accent top border -->
                            <div style="height: 3px; background: linear-gradient(90deg, #4338ca 0%%, #6366f1 50%%, #818cf8 100%%);"></div>

                            <!-- Content -->
                            <table role="presentation" style="width: 100%%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 40px 36px 12px;">
                                        <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #111827; line-height: 1.3;">
                                            &#128274; Reset Password
                                        </h1>
                                        <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                                            Buat password baru untuk akun AIValid Anda.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 20px 36px 32px;">
                                        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #374151;">
                                            Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru:
                                        </p>

                                        <!-- CTA Button -->
                                        <table role="presentation" style="margin: 0 0 24px; width: 100%%;">
                                            <tr>
                                                <td align="center">
                                                    <a href="%s" style="display: inline-block; padding: 13px 36px; background-color: #4338ca; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; line-height: 1; letter-spacing: 0.01em;">
                                                        Reset Password
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                            Link ini berlaku selama <strong style="color: #374151;">1 jam</strong>.
                                        </p>
                                        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                            Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
                                        </p>
                                    </td>
                                </tr>

                                <!-- Fallback Link -->
                                <tr>
                                    <td style="padding: 0 36px 36px;">
                                        <table role="presentation" style="width: 100%%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
                                                    <p style="margin: 0 0 6px; font-size: 12px; font-weight: 500; color: #6b7280;">
                                                        Tombol tidak bekerja? Salin link ini ke browser:
                                                    </p>
                                                    <p style="margin: 0; font-size: 12px; word-break: break-all; line-height: 1.5;">
                                                        <a href="%s" style="color: #4338ca; text-decoration: underline;">%s</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 28px 16px 0; text-align: center;">
                            <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                                © 2026 AIValid · Platform validasi hasil kerja AI
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #b0b5bf; line-height: 1.5;">
                                Email otomatis — mohon jangan membalas email ini.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`, resetLink, resetLink, resetLink)
}
