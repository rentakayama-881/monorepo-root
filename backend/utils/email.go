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

	// Fallback to dev mode if no API key configured
	if apiKey == "" {
		frontend := os.Getenv("FRONTEND_BASE_URL")
		if frontend == "" {
			frontend = "http://localhost:3000"
		}
		link := frontend + "/verify-email?token=" + verificationToken
		log.Printf("[DEV MODE] Email verification for %s: %s", recipientEmail, link)
		return nil
	}

	// Default sender email if not configured
	if fromEmail == "" {
		fromEmail = "onboarding@resend.dev" // Resend's test email
	}

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

	// Send email
	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{recipientEmail},
		Subject: "Verifikasi Email Anda",
		Html:    htmlBody,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Printf("Failed to send verification email to %s: %v", recipientEmail, err)
		return fmt.Errorf("gagal mengirim email verifikasi")
	}

	log.Printf("Verification email sent to %s (ID: %s)", recipientEmail, sent.Id)
	return nil
}

// buildVerificationEmailHTML creates a nice HTML template for verification email
func buildVerificationEmailHTML(verificationLink string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; max-width: 100%%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #111827;">
                                Verifikasi Email Anda
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Terima kasih telah mendaftar! Untuk menyelesaikan pendaftaran Anda, silakan verifikasi alamat email Anda dengan mengklik tombol di bawah ini:
                            </p>
                            
                            <!-- Button -->
                            <table role="presentation" style="margin: 30px 0; width: 100%%;">
                                <tr>
                                    <td align="center">
                                        <a href="%s" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                                            Verifikasi Email
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                                Link verifikasi ini akan kedaluwarsa dalam <strong>24 jam</strong>.
                            </p>
                            
                            <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                                Jika Anda tidak membuat akun ini, abaikan email ini.
                            </p>
                            
                            <!-- Alternative Link -->
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280;">
                                    Jika tombol tidak bekerja, salin dan tempel link berikut ke browser Anda:
                                </p>
                                <p style="margin: 0; font-size: 12px; color: #3b82f6; word-break: break-all;">
                                    <a href="%s" style="color: #3b82f6;">%s</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280; text-align: center;">
                                © 2025 Alephdraad Platform. All rights reserved.
                            </p>
                            <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                                Email ini dikirim secara otomatis. Mohon jangan membalas email ini.
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
